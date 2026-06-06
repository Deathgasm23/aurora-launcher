import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { LauncherSettings } from '../../shared/types'

const SETTINGS_FILE = 'settings.json'

export class SettingsService {
  private settingsPath: string
  private settings: LauncherSettings

  constructor(dataDir?: string) {
    const userDataPath = dataDir || app.getPath('userData')
    this.settingsPath = path.join(userDataPath, SETTINGS_FILE)
    this.settings = this.getDefaults()
    this.load()
  }

  private getDefaultMcDir(): string {
    if (process.platform === 'win32') return path.join(app.getPath('appData'), '.minecraft')
    if (process.platform === 'darwin') return path.join(app.getPath('appData'), 'minecraft')
    return path.join(app.getPath('home'), '.minecraft')
  }

  getDefaults(): LauncherSettings {
    return {
      minecraftDirectory: this.getDefaultMcDir(),
      javaPath: '',
      minMemory: 1024,
      maxMemory: 4096,
      javaArgs: '-XX:+UseG1GC -XX:-UseAdaptiveSizePolicy -XX:-OmitStackTraceInFastThrow -Dfml.ignoreInvalidMinecraftCertificates=true -Dfml.ignorePatchDiscrepancies=true',
      width: 854,
      height: 480,
      fullscreen: false,
      theme: 'dark',
      launchArgs: '',
      versionMemory: {},
      pinnedVersions: [],
      instanceNotes: {},
      autoCleanupDays: 30,
      autoCleanupLogs: false,
      performanceMode: false,
      launchProfiles: [],
      imgurClientId: '',
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'))
        this.settings = { ...this.getDefaults(), ...parsed }
      }
    } catch {
      this.settings = this.getDefaults()
    }
    this.migrateLegacyDir()
  }

  private migrateLegacyDir(): void {
    const oldDir = path.join(app.getPath('appData'), 'aurora-launcher', 'minecraft')
    const newDir = this.getDefaultMcDir()
    const current = this.settings.minecraftDirectory
    if (current !== oldDir) return
    if (!fs.existsSync(oldDir)) return
    const oldVersions = path.join(oldDir, 'versions')
    if (!fs.existsSync(oldVersions)) return
    if (fs.readdirSync(oldVersions).length === 0) return
    if (fs.existsSync(newDir)) return
    try {
      console.log(`Migrating minecraft directory: ${oldDir} -> ${newDir}`)
      const entries = fs.readdirSync(oldDir)
      for (const entry of entries) {
        const src = path.join(oldDir, entry)
        const dst = path.join(newDir, entry)
        try {
          if (fs.statSync(src).isDirectory()) {
            fs.cpSync(src, dst, { recursive: true })
          } else {
            fs.copyFileSync(src, dst)
          }
        } catch {}
      }
      this.settings.minecraftDirectory = newDir
      this.save()
    } catch (e) {
      console.warn('Migration failed:', e)
    }
  }

  save(): void {
    try {
      const dir = path.dirname(this.settingsPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  getSettingsPath(): string {
    return this.settingsPath
  }

  get(): LauncherSettings {
    return { ...this.settings }
  }

  update(partial: Partial<LauncherSettings>): LauncherSettings {
    this.settings = { ...this.settings, ...partial }
    this.save()
    return this.get()
  }

  reset(): LauncherSettings {
    this.settings = this.getDefaults()
    this.save()
    return this.get()
  }
}
