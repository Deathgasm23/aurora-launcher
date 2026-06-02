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

  getDefaults(): LauncherSettings {
    return {
      minecraftDirectory: path.join(app.getPath('home'), '.aurora-launcher', 'minecraft'),
      javaPath: '',
      minMemory: 1024,
      maxMemory: 4096,
      javaArgs: '-XX:+UseG1GC -XX:-UseAdaptiveSizePolicy -XX:-OmitStackTraceInFastThrow -Dfml.ignoreInvalidMinecraftCertificates=true -Dfml.ignorePatchDiscrepancies=true',
      width: 854,
      height: 480,
      fullscreen: false,
      theme: 'dark',
      accentColor: '#d97706',
      launchArgs: '',
      versionMemory: {},
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
