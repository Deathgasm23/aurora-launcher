import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { autoUpdater } from 'electron-updater'

app.name = 'Aurora Launcher'
import { AuthService } from './services/auth.service'
import { MinecraftService } from './services/minecraft.service'
import { LaunchService } from './services/launch.service'
import { SettingsService } from './services/settings.service'
import { JavaService } from './services/java.service'
import { NewsService } from './services/news.service'
import { LogsService } from './services/logs.service'
import { PlaytimeService } from './services/playtime.service'

const REPO_OWNER = 'Deathgasm23'
const REPO_NAME = 'aurora-launcher'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let authService: AuthService
let minecraftService: MinecraftService
let launchService: LaunchService
let settingsService: SettingsService
let javaService: JavaService
let newsService: NewsService
let logsService: LogsService
let playtimeService: PlaytimeService

function writeVarInt(value: number, buf: Buffer, offset: number): number {
  while (true) {
    if ((value & ~0x7F) === 0) { buf.writeUInt8(value, offset); return offset + 1 }
    buf.writeUInt8((value & 0x7F) | 0x80, offset); offset++; value >>>= 7
  }
}

function readVarInt(buf: Buffer, offset: number): { value: number; size: number } {
  let value = 0, size = 0
  while (true) {
    const byte = buf.readUInt8(offset + size)
    value |= (byte & 0x7F) << (size * 7)
    size++
    if ((byte & 0x80) === 0) return { value, size }
    if (size > 5) throw new Error('VarInt too big')
  }
}

const pingMinecraftServer = (host: string, port: number): Promise<any> => {
  return new Promise((resolve) => {
    const net = require('net')
    const startTime = Date.now()
    const socket = new net.Socket()
    let data = Buffer.alloc(0)
    let resolved = false

    const done = (result: any) => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      socket.destroy()
      resolve(result)
    }

    const timer = setTimeout(() => done({ online: false, latency: Date.now() - startTime }), 4000)

    socket.setTimeout(4000)
    socket.on('timeout', () => done({ online: false, latency: Date.now() - startTime }))

    socket.connect(port, host, () => {
      const hostBytes = Buffer.from(host, 'utf-8')
      const buf = Buffer.alloc(hostBytes.length + 10)
      let off = 0
      off = writeVarInt(0, buf, off)
      off = writeVarInt(-1, buf, off)
      off = writeVarInt(hostBytes.length, buf, off)
      hostBytes.copy(buf, off); off += hostBytes.length
      buf.writeUInt16BE(port, off); off += 2
      off = writeVarInt(1, buf, off)

      const header = Buffer.alloc(5)
      const hLen = writeVarInt(off, header, 0)

      socket.write(Buffer.concat([header.subarray(0, hLen), buf.subarray(0, off)]))
      socket.write(Buffer.from([1, 0]))
    })

    socket.on('data', (chunk: Buffer) => {
      data = Buffer.concat([data, chunk])
      try {
        const { value: pktLen, size: pktLenSize } = readVarInt(data, 0)
        if (data.length >= pktLen + pktLenSize) {
          const { value: pktId, size: pktIdSize } = readVarInt(data, pktLenSize)
          if (pktId === 0) {
            const { value: jsonLen, size: jsonLenSize } = readVarInt(data, pktLenSize + pktIdSize)
            if (data.length >= pktLenSize + pktIdSize + jsonLenSize + jsonLen) {
              const jsonStr = data.subarray(pktLenSize + pktIdSize + jsonLenSize, pktLenSize + pktIdSize + jsonLenSize + jsonLen).toString('utf-8')
              const json = JSON.parse(jsonStr)
              const motd = json.description?.text || (typeof json.description === 'string' ? json.description : undefined) ||
                (json.description?.extra ? json.description.extra.map((e: any) => e.text || '').join('') : JSON.stringify(json.description))
              return done({
                online: true, motd,
                players: json.players ? { online: json.players.online, max: json.players.max } : undefined,
                version: json.version?.name, protocol: json.version?.protocol,
                latency: Date.now() - startTime, icon: json.favicon,
              })
            }
          }
        }
      } catch {}
      try {
        if (data.length >= 3 && data[0] === 0xFF) {
          const len = data.readUInt16BE(1)
          if (data.length >= 3 + len) {
            const buf = Buffer.from(data.subarray(3, 3 + len))
            buf.swap16()
            const str = buf.toString('utf16le')
            const parts = str.split('\u00a7')
            if (parts.length >= 6) {
              return done({
                online: true, motd: parts[3],
                players: { online: parseInt(parts[4]) || 0, max: parseInt(parts[5]) || 0 },
                version: parts[2], latency: Date.now() - startTime,
              })
            }
          }
        }
      } catch {}
    })

    socket.on('error', () => done({ online: false, latency: Date.now() - startTime }))
  })
}

const setupAutoUpdater = (): void => {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: REPO_OWNER,
    repo: REPO_NAME,
  })

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update:checking')
  })
  autoUpdater.on('update-available', (info) => {
    logsService.add('info', `Update available: ${info.version}`, 'updater')
    mainWindow?.webContents.send('update:available', info)
  })
  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('update:not-available', info)
  })
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:download-progress', progress)
  })
  autoUpdater.on('update-downloaded', (info) => {
    logsService.add('info', `Update downloaded: ${info.version}`, 'updater')
    mainWindow?.webContents.send('update:downloaded', info)
  })
  autoUpdater.on('error', (err) => {
    const msg = err.message || ''
    const shortMsg = msg.replace(/\\n/g, '\n').split('\n')[0].trim()
    // Silently handle 404 / no-releases — expected before first publish
    if (/404|No release|not found|Cannot find latest\.yml/i.test(shortMsg)) {
      mainWindow?.webContents.send('update:not-available', null)
      return
    }
    logsService.add('error', `Update error: ${shortMsg}`, 'updater')
    const sanitized = shortMsg.length > 80 ? shortMsg.slice(0, 80) + '...' : shortMsg
    mainWindow?.webContents.send('update:error', sanitized)
  })
}

function setupTray(): void {
  const iconPath = path.join(__dirname, 'icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Aurora Launcher')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Aurora Launcher', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit() } },
  ]))
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false,
    backgroundColor: '#0f0f0f',
  })

  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function setupIPCHandlers(): void {
  // auth
  ipcMain.handle('auth:login-offline', (_event, username: string) => {
    return authService.loginOffline(username)
  })

  ipcMain.handle('auth:logout', (_event, accountId: string) => {
    authService.removeAccount(accountId)
  })

  ipcMain.handle('auth:get-accounts', () => {
    return authService.getAccounts()
  })

  ipcMain.handle('auth:set-current', (_event, accountId: string) => {
    authService.setCurrentAccount(accountId)
  })

  ipcMain.handle('auth:get-current', () => {
    return authService.getCurrentAccount()
  })

  // versions
  ipcMain.handle('versions:get-manifest', () => {
    return minecraftService.fetchManifest()
  })

  ipcMain.handle('versions:get-json', (_event, versionId: string) => {
    return minecraftService.fetchVersionJson(versionId)
  })

  ipcMain.handle('versions:install', (_event, versionId: string) => {
    return minecraftService.installVersion(versionId)
      .then(() => ({ success: true }))
      .catch((err: any) => ({ success: false, error: err.message }))
  })

  ipcMain.handle('versions:delete', (_event, versionId: string) => {
    try {
      minecraftService.deleteVersion(versionId)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('versions:reinstall', (_event, versionId: string) => {
    try {
      minecraftService.deleteVersion(versionId)
      return minecraftService.installVersion(versionId)
        .then(() => ({ success: true }))
        .catch((err: any) => ({ success: false, error: err.message }))
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('versions:get-installed', () => {
    return minecraftService.getInstalledVersions()
  })

  minecraftService.on('progress', (progress) => {
    if (mainWindow) mainWindow.webContents.send('versions:install-progress', progress)
  })

  // launch
  ipcMain.handle('launch:game', async (_event, accountId: string, versionId: string, javaOverride?: string) => {
    const account = authService.getAccounts().find(a => a.id === accountId)
    if (!account) return { success: false, error: 'Account not found' }

    const manifest = minecraftService.getManifestCached()
    const version = manifest?.versions.find(v => v.id === versionId)
    if (!version) return { success: false, error: 'Version not found' }

    const settings = { ...settingsService.get() }
    if (javaOverride) settings.javaPath = javaOverride
    const versionJson = await minecraftService.fetchVersionJson(versionId)

    logsService.clear()
    logsService.add('info', `Launching Minecraft ${versionId}...`, 'main')

    const launchStart = Date.now()

    try {
      launchService.on('output', (data: string) => {
        logsService.add('info', data.trimEnd(), 'game')
        mainWindow?.webContents.send('launch:output', data)
      })
      launchService.on('error', (data: string) => {
        logsService.add('error', data.trimEnd(), 'game')
        mainWindow?.webContents.send('launch:error', data)
      })
      launchService.on('exit', (code: number) => {
        const duration = Date.now() - launchStart
        playtimeService.recordSession(account.id, account.username, versionId, launchStart, duration)
        logsService.add('info', `Game exited with code ${code} (played ${Math.round(duration / 1000)}s)`, 'game')
        mainWindow?.webContents.send('launch:exit', code)
      })

      mainWindow?.hide()
      await launchService.launchGame({ account, version, settings, versionJson })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('launch:set-last-version', (_event, versionId: string) => {
    const s = settingsService.get()
    s.lastVersion = versionId
    settingsService.update(s)
  })

  ipcMain.handle('launch:get-java', () => {
    return javaService.detectInstallations()
  })

  ipcMain.handle('launch:validate-java', (_event, javaPath: string) => {
    return javaService.validateJava(javaPath)
  })

  ipcMain.handle('launch:game-with-extras', async (_event, accountId: string, versionId: string, extras: { serverAddress?: string; serverPort?: number; worldName?: string }) => {
    const account = authService.getAccounts().find(a => a.id === accountId)
    if (!account) return { success: false, error: 'Account not found' }
    const manifest = minecraftService.getManifestCached()
    const version = manifest?.versions.find(v => v.id === versionId)
    if (!version) return { success: false, error: 'Version not found' }
    const settings = { ...settingsService.get() }
    const versionJson = await minecraftService.fetchVersionJson(versionId)

    logsService.clear()
    logsService.add('info', `Launching Minecraft ${versionId}...`, 'main')

    const launchStart = Date.now()

    try {
      launchService.on('output', (data: string) => {
        logsService.add('info', data.trimEnd(), 'game')
        mainWindow?.webContents.send('launch:output', data)
      })
      launchService.on('error', (data: string) => {
        logsService.add('error', data.trimEnd(), 'game')
        mainWindow?.webContents.send('launch:error', data)
      })
      launchService.on('exit', (code: number) => {
        const duration = Date.now() - launchStart
        playtimeService.recordSession(account.id, account.username, versionId, launchStart, duration)
        logsService.add('info', `Game exited with code ${code} (played ${Math.round(duration / 1000)}s)`, 'game')
        mainWindow?.webContents.send('launch:exit', code)
      })
      mainWindow?.hide()
      await launchService.launchGame({ account, version, settings, versionJson, extras })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('playtime:stats', () => playtimeService.getStats())

  ipcMain.handle('settings:get', () => settingsService.get())
  ipcMain.handle('settings:set', (_event, newSettings: any) => settingsService.update(newSettings))
  ipcMain.handle('settings:get-default', () => settingsService.getDefaults())
  ipcMain.handle('settings:get-path', () => settingsService.getSettingsPath())

  ipcMain.handle('settings:export', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Settings',
      defaultPath: 'aurora-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { success: false }
    try {
      const settings = settingsService.get()
      require('fs').writeFileSync(result.filePath, JSON.stringify(settings, null, 2), 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:import', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Import Settings',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    try {
      const parsed = JSON.parse(require('fs').readFileSync(result.filePaths[0], 'utf-8'))
      settingsService.update(parsed)
      return { success: true, settings: settingsService.get() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:open-folder', async () => {
    shell.openPath(require('path').dirname(settingsService.getSettingsPath()))
  })

  ipcMain.handle('settings:select-folder', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Select Minecraft Directory',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }
    return { success: true, path: result.filePaths[0] }
  })

  ipcMain.handle('news:get', () => {
    return newsService.fetchNews()
  })

  ipcMain.handle('logs:get', () => logsService.getLogs())
  ipcMain.handle('logs:clear', () => logsService.clear())

  ipcMain.handle('shell:open-path', (_event, filePath: string) => {
    shell.openPath(filePath)
  })

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    shell.openExternal(url)
  })

  // window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    isQuitting = true
    app.quit()
  })

  // servers
  ipcMain.handle('servers:list', () => {
    const dataDir = app.isPackaged ? path.join(path.dirname(app.getPath('exe')), 'data') : app.getPath('userData')
    try {
      const serversPath = path.join(dataDir, 'servers.json')
      if (fs.existsSync(serversPath)) return JSON.parse(fs.readFileSync(serversPath, 'utf-8'))
    } catch {}
    return []
  })

  ipcMain.handle('servers:save', (_event, servers: any[]) => {
    const dataDir = app.isPackaged ? path.join(path.dirname(app.getPath('exe')), 'data') : app.getPath('userData')
    try {
      fs.writeFileSync(path.join(dataDir, 'servers.json'), JSON.stringify(servers, null, 2), 'utf-8')
      return { success: true }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('servers:ping', async (_event, address: string, port: number) => {
    try {
      return await pingMinecraftServer(address, port)
    } catch {
      return { online: false, latency: 0 }
    }
  })

  // screenshots
  ipcMain.handle('screenshots:list', () => {
    const mcDir = settingsService.get().minecraftDirectory
    const ssDir = path.join(mcDir, 'screenshots')
    if (!fs.existsSync(ssDir)) return []
    try {
      const entries = fs.readdirSync(ssDir, { withFileTypes: true })
      return entries.filter(e => e.isFile() && /\.(png|jpg|jpeg|bmp)$/i.test(e.name)).map(e => {
        const filePath = path.join(ssDir, e.name)
        const stats = fs.statSync(filePath)
        return { name: e.name, path: filePath, time: stats.mtimeMs, size: stats.size }
      }).sort((a, b) => b.time - a.time)
    } catch { return [] }
  })

  ipcMain.handle('screenshots:open', () => {
    const mcDir = settingsService.get().minecraftDirectory
    const ssDir = path.join(mcDir, 'screenshots')
    if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true })
    shell.openPath(ssDir)
  })

  // crash reports
  ipcMain.handle('crash-reports:list', () => {
    const mcDir = settingsService.get().minecraftDirectory
    const crDir = path.join(mcDir, 'crash-reports')
    if (!fs.existsSync(crDir)) return []
    try {
      const entries = fs.readdirSync(crDir, { withFileTypes: true })
      return entries.filter(e => e.isFile() && e.name.endsWith('.txt') || e.name.endsWith('.log')).map(e => {
        const filePath = path.join(crDir, e.name)
        const stats = fs.statSync(filePath)
        return { title: e.name, path: filePath, time: stats.mtimeMs, content: '' }
      }).sort((a, b) => b.time - a.time)
    } catch { return [] }
  })

  ipcMain.handle('crash-reports:get', (_event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) return { content: fs.readFileSync(filePath, 'utf-8') }
      return { content: '' }
    } catch { return { content: '' } }
  })

  // app
  ipcMain.handle('app:get-version', () => app.getVersion())

  ipcMain.handle('client:get-status', () => {
    const manifest = minecraftService.getManifestCached()
    const installed = manifest?.versions.filter(v => v.installed) || []
    const currentAccount = authService.getCurrentAccount()
    const javaInsts = javaService.getCachedInstallations?.() || []
    return {
      launcherVersion: app.getVersion(),
      installedVersions: installed.length,
      currentAccount: currentAccount?.username || null,
      javaInstallations: javaInsts.length,
      totalVersions: manifest?.versions.length || 0,
    }
  })

  ipcMain.handle('app:check-updates', async () => {
    try {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`)
      if (!response.ok) return { updateAvailable: false }
      const data: any = await response.json()
      const latestVersion = data.tag_name?.replace('v', '') || ''
      const currentVersion = app.getVersion()
      return {
        updateAvailable: latestVersion > currentVersion && latestVersion !== currentVersion,
        version: latestVersion,
      }
    } catch {
      return { updateAvailable: false }
    }
  })

  // update handlers
  ipcMain.handle('update:check', () => {
    try {
      autoUpdater.checkForUpdates()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('update:download', () => {
    try {
      autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('update:install', () => {
    try {
      autoUpdater.quitAndInstall()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

app.whenReady().then(() => {
  const portableExe = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')
  const dataDir = app.isPackaged
    ? path.join(path.dirname(portableExe), 'data')
    : app.getPath('userData')
  const mcBasePath = app.isPackaged
    ? path.join(path.dirname(portableExe), 'minecraft')
    : path.join(app.getPath('home'), '.aurora-launcher', 'minecraft')

  authService = new AuthService(dataDir)
  minecraftService = new MinecraftService(mcBasePath)
  minecraftService.ensureDirectories()
  launchService = new LaunchService()
  settingsService = new SettingsService(dataDir)
  javaService = new JavaService()
  newsService = new NewsService()
  logsService = new LogsService(dataDir)
  playtimeService = new PlaytimeService(dataDir)

  logsService.add('info', 'Launcher starting', 'main')
  setupIPCHandlers()
  setupAutoUpdater()
  setupTray()
  createWindow()

  setInterval(async () => {
    try {
      const newVersions = await minecraftService.checkForNewVersions()
      if (newVersions.length > 0) {
        logsService.add('info', `New versions detected: ${newVersions.join(', ')}`, 'main')
        mainWindow?.webContents.send('versions:new-versions', newVersions)
      }
    } catch {}
  }, 10 * 60 * 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (launchService) launchService.stop()
  logsService.add('info', 'Launcher shutting down', 'main')
  if (process.platform !== 'darwin') app.quit()
})
