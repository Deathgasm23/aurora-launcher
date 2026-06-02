import { ChildProcess, spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'events'
import { dialog, shell } from 'electron'
import { LaunchOptions, VersionJson, ArgRule, Rule } from '../../shared/types'

export class LaunchService extends EventEmitter {
  private process: ChildProcess | null = null
  private javaMajorVersion: number = 0

  async launchGame(options: LaunchOptions): Promise<void> {
    const { account, version, settings, versionJson, extras } = options
    const mcDir = settings.minecraftDirectory

    const jarPath = path.join(mcDir, 'versions', versionJson.id, `${versionJson.id}.jar`)
    if (!fs.existsSync(jarPath)) {
      throw new Error(`Missing game JAR for ${versionJson.id}. Try reinstalling this version.`)
    }

    const javaPath = settings.javaPath || 'java'
    await this.detectJavaVersion(javaPath)
    if (versionJson.javaVersion?.majorVersion && this.javaMajorVersion > 0) {
      const required = versionJson.javaVersion.majorVersion
      if (this.javaMajorVersion < required) {
        const result = await dialog.showMessageBox({
          type: 'warning',
          title: 'Java version too old',
          message: `This Minecraft version requires Java ${required}, but you have Java ${this.javaMajorVersion}.`,
          detail: `Download Java ${required} from:\nhttps://adoptium.net/temurin/releases/?version=${required}\n\nClick Cancel to abort, or OK to try launching anyway.`,
          buttons: ['Download Java', 'Launch anyway', 'Cancel'],
          defaultId: 0,
          cancelId: 2,
        })
        if (result.response === 0) {
          shell.openExternal(`https://adoptium.net/temurin/releases/?version=${required}`)
          throw new Error(`Java ${required} is required`)
        }
        if (result.response === 2) {
          throw new Error(`Java ${required} is required`)
        }
      }
    }

    const args = this.buildLaunchArgs(account, versionJson, mcDir, settings, extras)

    this.emit('output', `Launching ${version.id} with Java: ${javaPath}\n`)
    this.emit('output', `Memory: ${settings.minMemory}M - ${settings.maxMemory}M\n`)

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(javaPath, args, {
          cwd: mcDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: false,
          windowsHide: false,
        })

        this.process.stdout?.on('data', (data: Buffer) => {
          this.emit('output', data.toString())
        })

        this.process.stderr?.on('data', (data: Buffer) => {
          this.emit('output', data.toString())
        })

        this.process.on('error', (err) => {
          this.emit('error', `Failed to launch: ${err.message}`)
          reject(err)
        })

        this.process.on('exit', (code) => {
          this.emit('exit', code !== null ? code : -1)
          this.process = null
          if (code === 0) resolve()
          else reject(new Error(`Game exited with code ${code}`))
        })
      } catch (err: any) {
        reject(new Error(`Failed to start process: ${err.message}`))
      }
    })
  }

  private buildLaunchArgs(account: LaunchOptions['account'], versionJson: VersionJson, mcDir: string, settings: LaunchOptions['settings'], extras?: LaunchOptions['extras']): string[] {
    const args: string[] = []

    const minMem = settings.minMemory || 1024
    const maxMem = settings.maxMemory || 4096
    args.push(`-Xms${minMem}M`, `-Xmx${maxMem}M`)

    if (settings.javaArgs) {
      const extraArgs = settings.javaArgs.split(/\s+/).filter(Boolean)
      args.push(...extraArgs)
    }

    args.push('-Djava.library.path=' + this.getNativesPath(versionJson, mcDir))
    this.buildJvmArgs(versionJson).forEach(a => args.push(a))

    const classPath = this.buildClassPath(versionJson, mcDir)
    args.push('-cp', classPath)

    args.push(versionJson.mainClass || 'net.minecraft.client.main.Main')

    const gameArgs = this.buildGameArgs(account, versionJson, mcDir, settings, extras)
    args.push(...gameArgs)

    return args
  }

  private async detectJavaVersion(javaPath: string): Promise<void> {
    try {
      const { execFile } = await import('child_process')
      const result = await new Promise<string>((resolve, reject) => {
        const proc = execFile(javaPath, ['-version'], (err, _stdout, stderr) => {
          if (err) reject(err)
          else resolve(stderr || '')
        })
        proc.stdin?.end()
      })
      const match = result.match(/(?:version\s+["']?|openjdk\s+)(\d+)/)
      this.javaMajorVersion = match ? parseInt(match[1], 10) : 0
    } catch {
      this.javaMajorVersion = 0
    }
  }

  private jdkFlagsForVersion: Record<string, number> = {
    '--sun-misc-unsafe-memory-access': 22,
    '--enable-native-access': 22,
  }

  private buildJvmArgs(versionJson: VersionJson): string[] {
    const result: string[] = []
    if (!versionJson.arguments?.jvm) return result
    for (const arg of versionJson.arguments.jvm) {
      if (typeof arg === 'string') {
        const flagName = arg.split('=')[0].split(':')[0]
        const minVersion = this.jdkFlagsForVersion[flagName]
        if (!minVersion || this.javaMajorVersion >= minVersion) {
          result.push(arg)
        }
      } else if (this.evaluateRules(arg.rules)) {
        const values = Array.isArray(arg.value) ? arg.value : [arg.value]
        for (const v of values) {
          const flagName = v.split('=')[0].split(':')[0]
          const minVersion = this.jdkFlagsForVersion[flagName]
          if (!minVersion || this.javaMajorVersion >= minVersion) {
            result.push(v)
          }
        }
      }
    }
    return result
  }

  private getNativesPath(versionJson: VersionJson, mcDir: string): string {
    const nativesDir = path.join(mcDir, 'natives')
    if (!fs.existsSync(nativesDir)) fs.mkdirSync(nativesDir, { recursive: true })
    return nativesDir
  }

  private buildClassPath(versionJson: VersionJson, mcDir: string): string {
    const parts: string[] = []

    const versionDir = path.join(mcDir, 'versions', versionJson.id)
    const jarPath = path.join(versionDir, `${versionJson.id}.jar`)
    if (fs.existsSync(jarPath)) parts.push(jarPath)

    if (versionJson.libraries) {
      for (const lib of versionJson.libraries) {
        if (lib.downloads?.artifact?.path) {
          const libPath = path.join(mcDir, 'libraries', lib.downloads.artifact.path.replace(/\//g, path.sep))
          if (fs.existsSync(libPath)) parts.push(libPath)
        }
      }
    }

    return parts.join(path.delimiter)
  }

  private buildGameArgs(
    account: LaunchOptions['account'],
    versionJson: VersionJson,
    mcDir: string,
    settings: LaunchOptions['settings'],
    extras?: LaunchOptions['extras'],
  ): string[] {
    const args: string[] = []
    const features: Record<string, boolean> = {
      is_demo_user: false,
      has_custom_resolution: settings.width > 0 && settings.height > 0,
      has_quick_plays_support: false,
      is_quick_play_singleplayer: false,
      is_quick_play_multiplayer: false,
      is_quick_play_realms: false,
    }

    if (versionJson.arguments?.game) {
      for (const arg of versionJson.arguments.game) {
        if (typeof arg === 'string') {
          args.push(this.replaceTokens(arg, account, versionJson, mcDir, settings))
        } else if (this.evaluateRules(arg.rules, features)) {
          const values = Array.isArray(arg.value) ? arg.value : [arg.value]
          for (const v of values) {
            args.push(this.replaceTokens(v, account, versionJson, mcDir, settings))
          }
        }
      }
    } else if (versionJson.minecraftArguments) {
      const tokens = versionJson.minecraftArguments.split(/\s+/)
      for (const token of tokens) {
        args.push(this.replaceTokens(token, account, versionJson, mcDir, settings))
      }
    }

    if (settings.fullscreen) args.push('--fullscreen')

    if (settings.launchArgs) {
      const extraArgs = settings.launchArgs.split(/\s+/).filter(Boolean)
      args.push(...extraArgs)
    }

    if (extras?.serverAddress) {
      args.push('--server', extras.serverAddress)
      if (extras.serverPort) args.push('--port', extras.serverPort.toString())
    }

    if (extras?.worldName) {
      args.push('--quickPlaySingleplayer', extras.worldName)
    }

    return args
  }

  private evaluateRules(rules?: Rule[], features?: Record<string, boolean>): boolean {
    if (!rules || rules.length === 0) return true
    let allow = rules[0].action !== 'allow'
    for (const rule of rules) {
      let matches = true
      if (rule.os) {
        if (rule.os.name) matches = matches && rule.os.name === this.getCurrentOS()
        if (rule.os.arch) {
          const is64 = process.arch === 'x64' || process.arch === 'arm64'
          matches = matches && ((rule.os.arch === 'x86' && !is64) || (rule.os.arch === 'x64' && is64))
        }
        if (rule.os.version) {
          try { matches = matches && new RegExp(rule.os.version).test(process.version || '') } catch { matches = false }
        }
      }
      if (rule.features) {
        for (const [key, val] of Object.entries(rule.features)) {
          if ((features ?? {})[key] !== val) matches = false
        }
      }
      if (matches) allow = rule.action === 'allow'
    }
    return allow
  }

  private replaceTokens(
    arg: string,
    account: LaunchOptions['account'],
    versionJson: VersionJson,
    mcDir: string,
    settings: LaunchOptions['settings'],
  ): string {
    return arg
      .replace('${auth_player_name}', account.username)
      .replace('${auth_session}', account.accessToken || '')
      .replace('${auth_uuid}', account.uuid || '')
      .replace('${auth_access_token}', account.accessToken || '')
      .replace('${version_name}', versionJson.id)
      .replace('${game_assets}', path.join(mcDir, 'assets'))
      .replace('${assets_root}', path.join(mcDir, 'assets'))
      .replace('${assets_index_name}', versionJson.assets)
      .replace('${game_directory}', mcDir)
      .replace('${user_properties}', '{}')
      .replace('${user_type}', account.type === 'microsoft' ? 'msa' : 'mojang')
      .replace('${resolution_width}', settings.width.toString())
      .replace('${resolution_height}', settings.height.toString())
      .replace('${launcher_name}', 'aurora-launcher')
      .replace('${launcher_version}', '1.2.1')
      .replace('${classpath}', '')
      .replace('${library_directory}', path.join(mcDir, 'libraries'))
      .replace('${natives_directory}', path.join(mcDir, 'natives'))
      .replace('${version_type}', versionJson.type || 'release')
      .replace('${profile_name}', versionJson.id)
  }

  private getCurrentOS(): string {
    const p = process.platform
    if (p === 'win32') return 'windows'
    if (p === 'darwin') return 'osx'
    return 'linux'
  }

  stop(): void {
    if (this.process) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', this.process.pid!.toString(), '/f', '/t'])
      } else {
        this.process.kill('SIGTERM')
      }
      this.process = null
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }
}
