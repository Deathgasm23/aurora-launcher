import { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, clipboard } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { autoUpdater } from 'electron-updater'

app.name = 'Aurora Launcher'
app.setAppUserModelId('AuroraLauncher')
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

function getDataDir(): string {
  return path.join(app.getPath('appData'), 'Aurora Launcher', 'aurora-data')
}

function migrateOldDataDir(): void {
  const oldDir = path.join(app.getPath('appData'), 'aurora-launcher', 'aurora-data')
  const newDir = getDataDir()
  if (!fs.existsSync(oldDir) || oldDir === newDir) return
  if (fs.existsSync(newDir)) return
  try {
    const parent = path.dirname(newDir)
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true })
    fs.renameSync(oldDir, newDir)
  } catch {}
}

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

function ensureLauncherProfiles(mcDir: string): void {
  const profilePath = path.join(mcDir, 'launcher_profiles.json')
  if (!fs.existsSync(profilePath)) {
    fs.mkdirSync(mcDir, { recursive: true })
    fs.writeFileSync(profilePath, JSON.stringify({
      profiles: {},
      selectedProfile: '(Default)',
      clientToken: '00000000-0000-0000-0000-000000000000',
      launcherVersion: { name: '1.0', format: 0 },
    }, null, 2), 'utf-8')
  }
}

function getDirSize(dirPath: string): number {
  try {
    let total = 0
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(dirPath, e.name)
      if (e.isDirectory()) total += getDirSize(p)
      else total += fs.statSync(p).size
    }
    return total
  } catch { return 0 }
}

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
  updateTrayMenu()
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

function updateTrayMenu(): void {
  if (!tray) return
  const settings = settingsService?.get()
  const lastVersion = settings?.lastVersion
  const account = authService?.getCurrentAccount()
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: 'Show Aurora Launcher', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
  ]
  if (lastVersion && account) {
    items.push({
      label: `Launch ${lastVersion} (${account.username})`,
      click: async () => {
        try {
          const manifest = minecraftService.getManifestCached()
          const version = manifest?.versions.find(v => v.id === lastVersion)
          if (!version) return
          const versionJson = await minecraftService.fetchVersionJson(lastVersion)
          const s = settingsService.get()
          logsService.clear()
          logsService.add('info', `Launching Minecraft ${lastVersion} from tray...`, 'main')
          const launchStart = Date.now()
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
            playtimeService.recordSession(account.id, account.username, lastVersion, launchStart, duration)
            logsService.add('info', `Game exited with code ${code} (played ${Math.round(duration / 1000)}s)`, 'game')
            mainWindow?.webContents.send('launch:exit', code)
            mainWindow?.show()
            mainWindow?.focus()
          })
          mainWindow?.hide()
          await launchService.launchGame({ account, version, settings: s, versionJson })
        } catch (err: any) {
          logsService.add('error', `Tray launch failed: ${err.message}`, 'main')
          mainWindow?.webContents.send('launch:exit', -1)
          mainWindow?.show()
        }
      },
    })
    items.push({ type: 'separator' })
  }
  items.push({ label: 'Quit', click: () => { isQuitting = true; app.quit() } })
  tray.setContextMenu(Menu.buildFromTemplate(items))
}

function getWindowStatePath(): string {
  return path.join(getDataDir(), 'window-state.json')
}

function loadWindowState(): { x?: number; y?: number; width: number; height: number } {
  try {
    const p = getWindowStatePath()
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {}
  return { width: 1280, height: 800 }
}

function saveWindowState(): void {
  if (!mainWindow) return
  try {
    const bounds = mainWindow.getBounds()
    fs.writeFileSync(getWindowStatePath(), JSON.stringify({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }), 'utf-8')
  } catch {}
}

function createWindow(): void {
  const winState = loadWindowState()
  mainWindow = new BrowserWindow({
    x: winState.x,
    y: winState.y,
    width: winState.width,
    height: winState.height,
    minWidth: 1100,
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

  mainWindow.on('resize', saveWindowState)
  mainWindow.on('move', saveWindowState)

  mainWindow.on('close', (event) => {
    saveWindowState()
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
    const result = authService.loginOffline(username)
    updateTrayMenu()
    return result
  })

  ipcMain.handle('auth:logout', (_event, accountId: string) => {
    authService.removeAccount(accountId)
    updateTrayMenu()
  })

  ipcMain.handle('auth:get-accounts', () => {
    return authService.getAccounts()
  })

  ipcMain.handle('auth:set-current', (_event, accountId: string) => {
    authService.setCurrentAccount(accountId)
    updateTrayMenu()
  })

  ipcMain.handle('auth:get-current', () => {
    return authService.getCurrentAccount()
  })



  // versions
  ipcMain.handle('versions:get-manifest', () => {
    return minecraftService.fetchManifest()
  })

  ipcMain.handle('versions:refresh', () => {
    return minecraftService.refreshInstalled()
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
        mainWindow?.show()
        mainWindow?.focus()
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
        mainWindow?.show()
        mainWindow?.focus()
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
  ipcMain.handle('settings:set', (_event, newSettings: any) => {
    const result = settingsService.update(newSettings)
    if (newSettings?.minecraftDirectory) {
      ensureLauncherProfiles(newSettings.minecraftDirectory)
    }
    updateTrayMenu()
    return result
  })
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
    const cached = newsService.getCached()
    if (cached) {
      newsService.fetchNews()
      return cached
    }
    return newsService.fetchNews()
  })

  newsService.onRefresh((items) => {
    mainWindow?.webContents.send('news:updated', items)
  })

  ipcMain.handle('logs:get', () => logsService.getLogs())
  ipcMain.handle('logs:clear', () => logsService.clear())
  ipcMain.handle('logs:delete-entry', (_event, index: number) => logsService.deleteEntry(index))
  ipcMain.handle('logs:delete-all-files', () => logsService.deleteAllFiles())

  ipcMain.handle('shell:open-path', (_event, filePath: string) => {
    shell.openPath(filePath)
  })

  ipcMain.handle('shell:open-settings-folder', async () => {
    const p = app.getPath('userData')
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    await shell.openPath(p)
  })

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    return shell.openExternal(url)
  })

  ipcMain.handle('dialog:read-text-file', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return fs.readFileSync(result.filePaths[0], 'utf-8')
  })

  ipcMain.handle('dialog:write-text-file', async (_event, content: string, defaultName?: string) => {
    const { dialog } = require('electron')
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Servers',
      defaultPath: defaultName || 'servers.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    })
    if (result.canceled || !result.filePath) return { success: false }
    try {
      fs.writeFileSync(result.filePath, content, 'utf-8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
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
    const dataDir = getDataDir()
    try {
      const serversPath = path.join(dataDir, 'servers.json')
      if (fs.existsSync(serversPath)) return JSON.parse(fs.readFileSync(serversPath, 'utf-8'))
    } catch {}
    return []
  })

  ipcMain.handle('servers:save', (_event, servers: any[]) => {
    const dataDir = getDataDir()
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

  ipcMain.handle('screenshots:delete', (_event, filePath: string) => {
    try {
      fs.unlinkSync(filePath)
      return { success: true }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('shell:show-item', (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('screenshots:copy-image', (_event, filePath: string) => {
    try {
      const img = nativeImage.createFromPath(filePath)
      if (img.isEmpty()) return { success: false, error: 'Failed to read image' }
      clipboard.writeImage(img)
      return { success: true }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('screenshots:upload-imgur', async (_event, filePath: string) => {
    try {
      const imgurClientId = settingsService.get().imgurClientId
      if (!imgurClientId) {
        return { success: false, error: 'Imgur Client-ID not set. Add yours in Settings > Integrations.' }
      }
      const image = fs.readFileSync(filePath)
      const b64 = image.toString('base64')
      const fetch = (await import('node-fetch')).default
      const res = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          Authorization: `Client-ID ${imgurClientId}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `image=${encodeURIComponent(b64)}&type=base64`,
      })
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { return { success: false, error: `Imgur returned non-JSON (HTTP ${res.status})` } }
      if (data.success) {
        return { success: true, url: data.data.link }
      }
      return { success: false, error: data.data?.error || 'Upload failed' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
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

  ipcMain.handle('crash-reports:delete', (_event, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return true
    } catch { return false }
  })

  ipcMain.handle('crash-reports:delete-all', () => {
    try {
      const mcDir = settingsService.get().minecraftDirectory
      const crDir = path.join(mcDir, 'crash-reports')
      if (fs.existsSync(crDir)) {
        const entries = fs.readdirSync(crDir)
        for (const entry of entries) fs.unlinkSync(path.join(crDir, entry))
      }
      return true
    } catch { return false }
  })

  // worlds
  ipcMain.handle('worlds:list', () => {
    try {
      const mcDir = settingsService.get().minecraftDirectory
      const savesDir = path.join(mcDir, 'saves')
      if (!fs.existsSync(savesDir)) return []
      const entries = fs.readdirSync(savesDir, { withFileTypes: true })
      return entries.filter(e => e.isDirectory()).map(e => {
        const levelPath = path.join(savesDir, e.name, 'level.dat')
        const stats = fs.statSync(path.join(savesDir, e.name))
        return {
          name: e.name,
          path: path.join(savesDir, e.name),
          lastPlayed: stats.mtimeMs,
          size: getDirSize(path.join(savesDir, e.name)),
          hasLevelDat: fs.existsSync(levelPath),
        }
      }).sort((a, b) => b.lastPlayed - a.lastPlayed)
    } catch { return [] }
  })

  ipcMain.handle('worlds:backup', (_event, worldName: string) => {
    try {
      const mcDir = settingsService.get().minecraftDirectory
      const savesDir = path.join(mcDir, 'saves')
      const dataDir = getDataDir()
      const backupsDir = path.join(dataDir, 'world-backups')
      if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true })
      const worldPath = path.join(savesDir, worldName)
      if (!fs.existsSync(worldPath)) return { success: false, error: 'World not found' }
      const sanitized = worldName.replace(/[^a-zA-Z0-9_\- ]/g, '_')
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const zipPath = path.join(backupsDir, `${sanitized}_${dateStr}.zip`)
      const archiver = require('archiver')
      return new Promise((resolve) => {
        const output = fs.createWriteStream(zipPath)
        const archive = archiver('zip', { zlib: { level: 9 } })
        output.on('close', () => resolve({ success: true, path: zipPath, size: archive.pointer() }))
        archive.on('error', (err: any) => resolve({ success: false, error: err.message }))
        archive.pipe(output)
        archive.directory(worldPath, worldName)
        archive.finalize()
      })
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('worlds:list-backups', () => {
    try {
      const dataDir = getDataDir()
      const backupsDir = path.join(dataDir, 'world-backups')
      if (!fs.existsSync(backupsDir)) return []
      const entries = fs.readdirSync(backupsDir, { withFileTypes: true })
      return entries.filter(e => e.isFile() && e.name.endsWith('.zip')).map(e => {
        const p = path.join(backupsDir, e.name)
        const stats = fs.statSync(p)
        const parts = e.name.replace('.zip', '').split('_')
        const worldName = parts.slice(0, -3).join('_') || e.name
        return { name: e.name, path: p, size: stats.size, time: stats.mtimeMs, worldName }
      }).sort((a, b) => b.time - a.time)
    } catch { return [] }
  })

  ipcMain.handle('worlds:restore', (_event, backupPath: string) => {
    try {
      const mcDir = settingsService.get().minecraftDirectory
      const savesDir = path.join(mcDir, 'saves')
      if (!fs.existsSync(savesDir)) fs.mkdirSync(savesDir, { recursive: true })
      const extract = require('extract-zip')
      return extract(backupPath, { dir: savesDir })
        .then(() => ({ success: true }))
        .catch((err: any) => ({ success: false, error: err.message }))
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('worlds:delete-backup', (_event, backupPath: string) => {
    try {
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath)
      return { success: true }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  // resource packs
  ipcMain.handle('resource-packs:list', () => {
    try {
      const mcDir = settingsService.get().minecraftDirectory
      const rpDir = path.join(mcDir, 'resourcepacks')
      if (!fs.existsSync(rpDir)) return []
      const entries = fs.readdirSync(rpDir, { withFileTypes: true })
      return entries.filter(e => {
        if (e.isDirectory()) return true
        return e.isFile() && (e.name.endsWith('.zip') || e.name.endsWith('.mcpack'))
      }).map(e => {
        const p = path.join(rpDir, e.name)
        const stats = fs.statSync(p)
        return { name: e.name, path: p, isDirectory: e.isDirectory(), size: stats.size, modified: stats.mtimeMs }
      }).sort((a, b) => a.name.localeCompare(b.name))
    } catch { return [] }
  })

  ipcMain.handle('resource-packs:delete', (_event, packPath: string) => {
    try {
      const stat = fs.statSync(packPath)
      if (stat.isDirectory()) {
        fs.rmSync(packPath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(packPath)
      }
      return { success: true }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('resource-packs:open-folder', () => {
    try {
      const mcDir = settingsService.get().minecraftDirectory
      const rpDir = path.join(mcDir, 'resourcepacks')
      if (!fs.existsSync(rpDir)) fs.mkdirSync(rpDir, { recursive: true })
      shell.openPath(rpDir)
      return { success: true }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  // shader packs
  ipcMain.handle('shaderpacks:list', () => {
    try {
      const mcDir = settingsService.get().minecraftDirectory
      const spDir = path.join(mcDir, 'shaderpacks')
      if (!fs.existsSync(spDir)) return []
      const entries = fs.readdirSync(spDir, { withFileTypes: true })
      return entries.filter(e => {
        if (e.isDirectory()) return true
        return e.isFile() && (e.name.endsWith('.zip') || e.name.endsWith('.mcpack'))
      }).map(e => {
        const p = path.join(spDir, e.name)
        const stats = fs.statSync(p)
        return { name: e.name, path: p, isDirectory: e.isDirectory(), size: stats.size, modified: stats.mtimeMs }
      }).sort((a, b) => a.name.localeCompare(b.name))
    } catch { return [] }
  })

  ipcMain.handle('shaderpacks:delete', (_event, packPath: string) => {
    try {
      const stat = fs.statSync(packPath)
      if (stat.isDirectory()) {
        fs.rmSync(packPath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(packPath)
      }
      return { success: true }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('shaderpacks:open-folder', () => {
    try {
      const mcDir = settingsService.get().minecraftDirectory
      const spDir = path.join(mcDir, 'shaderpacks')
      if (!fs.existsSync(spDir)) fs.mkdirSync(spDir, { recursive: true })
      shell.openPath(spDir)
      return { success: true }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  // Modrinth API
  ipcMain.handle('modrinth:search', async (_event, query: string, projectType: string, limit: number = 20, index?: string, versions?: string[], loaders?: string[]) => {
    try {
      const { default: fetch } = await import('node-fetch')
      const facets: string[][] = [[`project_type:${projectType}`]]
      if (versions?.length) facets.push(versions.map(v => `versions:${v}`))
      if (loaders?.length) facets.push(loaders.map(l => `categories:${l}`))
      let url = `https://api.modrinth.com/v2/search?facets=${encodeURIComponent(JSON.stringify(facets))}&limit=${limit}`
      if (query) url += `&query=${encodeURIComponent(query)}`
      if (index) url += `&index=${index}`
      const res = await fetch(url)
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
      const data = await res.json()
      return { success: true, hits: data.hits, total: data.total_hits }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('modrinth:versions', async (_event, projectId: string) => {
    try {
      const { default: fetch } = await import('node-fetch')
      const res = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`)
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
      const versions = await res.json()
      return { success: true, versions }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('modrinth:install', async (event, projectId: string, destinationDir: string, fileName?: string) => {
    try {
      const { default: fetch } = await import('node-fetch')
      const res = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`)
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
      const versions = await res.json()
      if (!versions || versions.length === 0) return { success: false, error: 'No versions found' }
      const latest = versions[0]
      const file = latest.files?.[0]
      if (!file?.url) return { success: false, error: 'No downloadable file found' }
      if (!fs.existsSync(destinationDir)) fs.mkdirSync(destinationDir, { recursive: true })
      const dest = path.join(destinationDir, fileName || file.filename)
      if (fs.existsSync(dest)) return { success: false, error: `File "${path.basename(dest)}" already exists` }
      const fileRes = await fetch(file.url)
      if (!fileRes.ok) return { success: false, error: `Download failed: HTTP ${fileRes.status}` }
      const total = parseInt(fileRes.headers.get('content-length') || '0', 10)
      let bytes = 0
      const chunks: Buffer[] = []
      await new Promise<void>((resolve, reject) => {
        fileRes.body.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          chunks.push(chunk)
          if (total > 0) event.sender.send('modrinth:download-progress', { projectId, bytes, total })
        })
        fileRes.body.on('end', () => {
          event.sender.send('modrinth:download-progress', { projectId, bytes: total || bytes, total: total || bytes })
          resolve()
        })
        fileRes.body.on('error', reject)
      })
      fs.writeFileSync(dest, Buffer.concat(chunks))
      return { success: true, path: dest, fileName: file.filename }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('modrinth:projects', async (_event, projectIds: string[]) => {
    try {
      const { default: fetch } = await import('node-fetch')
      const url = `https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(projectIds))}`
      const res = await fetch(url)
      if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
      const projects = await res.json()
      return { success: true, projects }
    } catch (err: any) { return { success: false, error: err.message } }
  })

  ipcMain.handle('cleanup:run', () => {
    try {
      const settings = settingsService.get()
      const days = settings.autoCleanupDays || 30
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      const mcDir = settings.minecraftDirectory
      let deleted = 0

      const crDir = path.join(mcDir, 'crash-reports')
      if (fs.existsSync(crDir)) {
        for (const entry of fs.readdirSync(crDir)) {
          const p = path.join(crDir, entry)
          if (fs.statSync(p).mtimeMs < cutoff) { fs.unlinkSync(p); deleted++ }
        }
      }

      if (settings.autoCleanupLogs) {
        const logDir = path.join(mcDir, 'logs')
        if (fs.existsSync(logDir)) {
          for (const entry of fs.readdirSync(logDir)) {
            const p = path.join(logDir, entry)
            if (fs.statSync(p).mtimeMs < cutoff) { fs.unlinkSync(p); deleted++ }
          }
        }
      }
      return { success: true, deleted }
    } catch { return { success: false, deleted: 0 } }
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
  migrateOldDataDir()
  const dataDir = getDataDir()

  createWindow()

  settingsService = new SettingsService(dataDir)
  const mcBasePath = settingsService.get().minecraftDirectory

  authService = new AuthService(dataDir)
  minecraftService = new MinecraftService(mcBasePath)
  minecraftService.ensureDirectories()
  launchService = new LaunchService()
  javaService = new JavaService()
  newsService = new NewsService()
  logsService = new LogsService(dataDir)
  playtimeService = new PlaytimeService(dataDir)

  ensureLauncherProfiles(settingsService.get().minecraftDirectory)

  logsService.add('info', 'Launcher starting', 'main')
  setupIPCHandlers()
  setupAutoUpdater()
  setupTray()

  newsService.fetchNews()

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
