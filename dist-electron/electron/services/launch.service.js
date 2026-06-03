"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LaunchService = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_1 = require("events");
const electron_1 = require("electron");
class LaunchService extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.process = null;
        this.javaMajorVersion = 0;
        this.jdkFlagsForVersion = {
            '--sun-misc-unsafe-memory-access': 22,
            '--enable-native-access': 22,
        };
    }
    async launchGame(options) {
        const { account, version, settings, versionJson, extras } = options;
        const mcDir = settings.minecraftDirectory;
        const jarPath = path.join(mcDir, 'versions', versionJson.id, `${versionJson.id}.jar`);
        if (!fs.existsSync(jarPath)) {
            throw new Error(`Missing game JAR for ${versionJson.id}. Try reinstalling this version.`);
        }
        const javaPath = settings.javaPath || 'java';
        await this.detectJavaVersion(javaPath);
        if (versionJson.javaVersion?.majorVersion && this.javaMajorVersion > 0) {
            const required = versionJson.javaVersion.majorVersion;
            if (this.javaMajorVersion < required) {
                const result = await electron_1.dialog.showMessageBox({
                    type: 'warning',
                    title: 'Java version too old',
                    message: `This Minecraft version requires Java ${required}, but you have Java ${this.javaMajorVersion}.`,
                    detail: `Download Java ${required} from:\nhttps://adoptium.net/temurin/releases/?version=${required}\n\nClick Cancel to abort, or OK to try launching anyway.`,
                    buttons: ['Download Java', 'Launch anyway', 'Cancel'],
                    defaultId: 0,
                    cancelId: 2,
                });
                if (result.response === 0) {
                    electron_1.shell.openExternal(`https://adoptium.net/temurin/releases/?version=${required}`);
                    throw new Error(`Java ${required} is required`);
                }
                if (result.response === 2) {
                    throw new Error(`Java ${required} is required`);
                }
            }
        }
        const args = this.buildLaunchArgs(account, versionJson, mcDir, settings, extras);
        const vm = settings.versionMemory?.[versionJson.id];
        const launchMaxMem = vm?.maxMemory || settings.maxMemory || 4096;
        if (extras?.serverAddress) {
            this.writeServerList(mcDir, version.id, extras.serverAddress, extras.serverPort || 25565);
            this.emit('output', `Auto-connecting to server: ${extras.serverAddress}:${extras.serverPort || 25565}\n`);
        }
        this.emit('output', `Launching ${version.id} with Java: ${javaPath}\n`);
        this.emit('output', `Memory: 1024M - ${launchMaxMem}M${vm?.maxMemory ? ' (per-version)' : ''}\n`);
        this.emit('output', `Command: ${javaPath} ${args.slice(0, 3).join(' ')} ... ${args.slice(-6).join(' ')}\n`);
        return new Promise((resolve, reject) => {
            try {
                this.process = (0, child_process_1.spawn)(javaPath, args, {
                    cwd: mcDir,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: false,
                    windowsHide: false,
                });
                let started = false;
                this.process.stdout?.on('data', (data) => {
                    this.emit('output', data.toString());
                    if (!started) {
                        started = true;
                        resolve();
                    }
                });
                this.process.stderr?.on('data', (data) => {
                    this.emit('output', data.toString());
                });
                this.process.on('error', (err) => {
                    this.emit('error', `Failed to launch: ${err.message}`);
                    reject(err);
                });
                this.process.on('exit', (code) => {
                    this.emit('exit', code !== null ? code : -1);
                    this.process = null;
                    if (!started) {
                        started = true;
                        if (code === 0)
                            resolve();
                        else
                            reject(new Error(`Game exited with code ${code}`));
                    }
                });
                // resolve after a short delay if no output yet (e.g. headless / slow JVM)
                setTimeout(() => { if (!started) {
                    started = true;
                    resolve();
                } }, 3000);
            }
            catch (err) {
                reject(new Error(`Failed to start process: ${err.message}`));
            }
        });
    }
    buildLaunchArgs(account, versionJson, mcDir, settings, extras) {
        const args = [];
        const minMem = 1024;
        const vm = settings.versionMemory?.[versionJson.id];
        const maxMem = vm?.maxMemory || settings.maxMemory || 4096;
        args.push(`-Xms${minMem}M`, `-Xmx${maxMem}M`);
        if (settings.javaArgs) {
            const extraArgs = settings.javaArgs.split(/\s+/).filter(Boolean);
            args.push(...extraArgs);
        }
        args.push('-Djava.library.path=' + this.getNativesPath(versionJson, mcDir));
        this.buildJvmArgs(versionJson).forEach(a => args.push(a));
        const classPath = this.buildClassPath(versionJson, mcDir);
        args.push('-cp', classPath);
        args.push(versionJson.mainClass || 'net.minecraft.client.main.Main');
        const gameArgs = this.buildGameArgs(account, versionJson, mcDir, settings, extras);
        args.push(...gameArgs);
        return args;
    }
    writeServerList(mcDir, name, address, port) {
        try {
            const serversPath = path.join(mcDir, 'servers.dat');
            const nbt = require('prismarine-nbt');
            const newIp = `${address}:${port}`;
            this.emit('output', `Writing ${newIp} to server list at ${serversPath}\n`);
            let entries = [];
            if (fs.existsSync(serversPath)) {
                try {
                    const raw = fs.readFileSync(serversPath);
                    const parsed = nbt.parseUncompressed(raw);
                    const list = parsed?.value?.servers?.value?.value;
                    if (Array.isArray(list)) {
                        for (const e of list) {
                            if (e.ip?.value === newIp) {
                                entries = [{ name: { type: 'string', value: name }, ip: { type: 'string', value: newIp }, icon: { type: 'string', value: '' }, acceptTextures: { type: 'byte', value: 0 } }];
                                this.emit('output', `Updated ${name} in multiplayer server list\n`);
                                const data = nbt.writeUncompressed({ name: '', type: 'compound', value: { servers: { type: 'list', value: { type: 'compound', value: entries } } } });
                                fs.writeFileSync(serversPath, data);
                                return;
                            }
                            entries.push(e);
                        }
                    }
                }
                catch (err) {
                    this.emit('output', `Reading existing servers.dat failed, will overwrite: ${err}\n`);
                    entries = [];
                }
            }
            entries.push({
                name: { type: 'string', value: name },
                ip: { type: 'string', value: newIp },
                icon: { type: 'string', value: '' },
                acceptTextures: { type: 'byte', value: 0 },
            });
            const data = nbt.writeUncompressed({ name: '', type: 'compound', value: { servers: { type: 'list', value: { type: 'compound', value: entries } } } });
            fs.writeFileSync(serversPath, data);
            // Verify write by reading back
            const verify = nbt.parseUncompressed(fs.readFileSync(serversPath));
            const count = verify?.value?.servers?.value?.value?.length || 0;
            this.emit('output', `Added ${name} to multiplayer server list (${count} entries)\n`);
        }
        catch (err) {
            this.emit('output', `Could not update server list: ${err.message}\n`);
        }
    }
    async detectJavaVersion(javaPath) {
        try {
            const { execFile } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const result = await new Promise((resolve, reject) => {
                const proc = execFile(javaPath, ['-version'], (err, _stdout, stderr) => {
                    if (err)
                        reject(err);
                    else
                        resolve(stderr || '');
                });
                proc.stdin?.end();
            });
            const match = result.match(/(?:version\s+["']?|openjdk\s+)(\d+)/);
            this.javaMajorVersion = match ? parseInt(match[1], 10) : 0;
        }
        catch {
            this.javaMajorVersion = 0;
        }
    }
    buildJvmArgs(versionJson) {
        const result = [];
        if (!versionJson.arguments?.jvm)
            return result;
        for (const arg of versionJson.arguments.jvm) {
            if (typeof arg === 'string') {
                const flagName = arg.split('=')[0].split(':')[0];
                const minVersion = this.jdkFlagsForVersion[flagName];
                if (!minVersion || this.javaMajorVersion >= minVersion) {
                    result.push(arg);
                }
            }
            else if (this.evaluateRules(arg.rules)) {
                const values = Array.isArray(arg.value) ? arg.value : [arg.value];
                for (const v of values) {
                    const flagName = v.split('=')[0].split(':')[0];
                    const minVersion = this.jdkFlagsForVersion[flagName];
                    if (!minVersion || this.javaMajorVersion >= minVersion) {
                        result.push(v);
                    }
                }
            }
        }
        return result;
    }
    getNativesPath(versionJson, mcDir) {
        const nativesDir = path.join(mcDir, 'natives');
        if (!fs.existsSync(nativesDir))
            fs.mkdirSync(nativesDir, { recursive: true });
        return nativesDir;
    }
    buildClassPath(versionJson, mcDir) {
        const parts = [];
        const versionDir = path.join(mcDir, 'versions', versionJson.id);
        const jarPath = path.join(versionDir, `${versionJson.id}.jar`);
        if (fs.existsSync(jarPath))
            parts.push(jarPath);
        if (versionJson.libraries) {
            for (const lib of versionJson.libraries) {
                if (lib.downloads?.artifact?.path) {
                    const libPath = path.join(mcDir, 'libraries', lib.downloads.artifact.path.replace(/\//g, path.sep));
                    if (fs.existsSync(libPath))
                        parts.push(libPath);
                }
            }
        }
        return parts.join(path.delimiter);
    }
    buildGameArgs(account, versionJson, mcDir, settings, extras) {
        const args = [];
        const features = {
            is_demo_user: false,
            has_custom_resolution: settings.width > 0 && settings.height > 0,
            has_quick_plays_support: !!extras?.serverAddress || !!extras?.worldName,
            is_quick_play_singleplayer: !!extras?.worldName,
            is_quick_play_multiplayer: !!extras?.serverAddress,
            is_quick_play_realms: false,
        };
        if (versionJson.arguments?.game) {
            for (const arg of versionJson.arguments.game) {
                if (typeof arg === 'string') {
                    args.push(this.replaceTokens(arg, account, versionJson, mcDir, settings, extras));
                }
                else if (this.evaluateRules(arg.rules, features)) {
                    const values = Array.isArray(arg.value) ? arg.value : [arg.value];
                    for (const v of values) {
                        args.push(this.replaceTokens(v, account, versionJson, mcDir, settings, extras));
                    }
                }
            }
        }
        else if (versionJson.minecraftArguments) {
            const tokens = versionJson.minecraftArguments.split(/\s+/);
            for (const token of tokens) {
                args.push(this.replaceTokens(token, account, versionJson, mcDir, settings, extras));
            }
        }
        if (settings.fullscreen)
            args.push('--fullscreen');
        if (settings.launchArgs) {
            const extraArgs = settings.launchArgs.split(/\s+/).filter(Boolean);
            args.push(...extraArgs);
        }
        if (extras?.serverAddress) {
            const hasQuickPlay = versionJson.arguments?.game?.some((arg) => typeof arg === 'object' && arg.rules?.some((r) => r.features?.is_quick_play_multiplayer !== undefined));
            if (!hasQuickPlay) {
                args.push('--server', extras.serverAddress);
                if (extras.serverPort)
                    args.push('--port', extras.serverPort.toString());
            }
        }
        return args;
    }
    evaluateRules(rules, features) {
        if (!rules || rules.length === 0)
            return true;
        let allow = rules[0].action !== 'allow';
        for (const rule of rules) {
            let matches = true;
            if (rule.os) {
                if (rule.os.name)
                    matches = matches && rule.os.name === this.getCurrentOS();
                if (rule.os.arch) {
                    const is64 = process.arch === 'x64' || process.arch === 'arm64';
                    matches = matches && ((rule.os.arch === 'x86' && !is64) || (rule.os.arch === 'x64' && is64));
                }
                if (rule.os.version) {
                    try {
                        matches = matches && new RegExp(rule.os.version).test(process.version || '');
                    }
                    catch {
                        matches = false;
                    }
                }
            }
            if (rule.features) {
                for (const [key, val] of Object.entries(rule.features)) {
                    if ((features ?? {})[key] !== val)
                        matches = false;
                }
            }
            if (matches)
                allow = rule.action === 'allow';
        }
        return allow;
    }
    replaceTokens(arg, account, versionJson, mcDir, settings, extras) {
        const quickPlayMultiplayer = extras?.serverAddress
            ? `${extras.serverAddress}:${extras.serverPort || 25565}`
            : '';
        const quickPlaySingleplayer = extras?.worldName || '';
        const quickPlayPath = quickPlayMultiplayer || quickPlaySingleplayer
            ? path.join(mcDir, 'quickPlay', 'config.json')
            : '';
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
            .replace('${launcher_version}', '1.2.8')
            .replace('${classpath}', '')
            .replace('${library_directory}', path.join(mcDir, 'libraries'))
            .replace('${natives_directory}', path.join(mcDir, 'natives'))
            .replace('${version_type}', versionJson.type || 'release')
            .replace('${profile_name}', versionJson.id)
            .replace('${quickPlayPath}', quickPlayPath)
            .replace('${quickPlayMultiplayer}', quickPlayMultiplayer)
            .replace('${quickPlaySingleplayer}', quickPlaySingleplayer)
            .replace('${quickPlayRealms}', '');
    }
    getCurrentOS() {
        const p = process.platform;
        if (p === 'win32')
            return 'windows';
        if (p === 'darwin')
            return 'osx';
        return 'linux';
    }
    stop() {
        if (this.process) {
            if (process.platform === 'win32') {
                (0, child_process_1.spawn)('taskkill', ['/pid', this.process.pid.toString(), '/f', '/t']);
            }
            else {
                this.process.kill('SIGTERM');
            }
            this.process = null;
        }
    }
    isRunning() {
        return this.process !== null && !this.process.killed;
    }
}
exports.LaunchService = LaunchService;
