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
exports.ModLoadersService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_1 = require("events");
class ModLoadersService extends events_1.EventEmitter {
    constructor(mcBasePath) {
        super();
        this.mcBasePath = mcBasePath;
    }
    async fetchForgeVersions(mcVersion) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const url = `https://meta.multimc.org/v1/net.minecraftforge/${mcVersion}/index.json`;
            const resp = await fetch(url);
            if (!resp.ok) {
                const fallback = await this.fetchForgeFromMaven(mcVersion);
                if (fallback.length > 0)
                    return fallback;
                return [];
            }
            const data = await resp.json();
            return (data || []).map((v) => ({
                type: 'forge',
                mcVersion,
                loaderVersion: v.version,
                installerUrl: `https://maven.minecraftforge.net/net/minecraftforge/forge/${v.version}/forge-${v.version}-installer.jar`,
                mainClass: 'net.minecraftforge.bootstrap.ForgeBootstrap',
            }));
        }
        catch {
            return [];
        }
    }
    async fetchForgeFromMaven(mcVersion) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const url = 'https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml';
            const resp = await fetch(url);
            if (!resp.ok)
                return [];
            const xml = await resp.text();
            const versions = [];
            const regex = /<version>([^<]+)<\/version>/g;
            let match;
            while ((match = regex.exec(xml)) !== null) {
                const ver = match[1];
                if (ver.startsWith(mcVersion + '-') || ver.startsWith(mcVersion + '.')) {
                    versions.push(ver);
                }
            }
            return versions.sort().reverse().slice(0, 10).map(ver => ({
                type: 'forge',
                mcVersion,
                loaderVersion: ver,
                installerUrl: `https://maven.minecraftforge.net/net/minecraftforge/forge/${ver}/forge-${ver}-installer.jar`,
                mainClass: 'net.minecraftforge.bootstrap.ForgeBootstrap',
            }));
        }
        catch {
            return [];
        }
    }
    async fetchNeoForgeVersions(mcVersion) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const url = 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml';
            const resp = await fetch(url);
            if (!resp.ok) {
                const fallback = await this.fetchNeoForgeFromPromos(mcVersion);
                return fallback;
            }
            const xml = await resp.text();
            const versions = [];
            const regex = /<version>([^<]+)<\/version>/g;
            let match;
            while ((match = regex.exec(xml)) !== null) {
                const ver = match[1];
                if (ver.startsWith(mcVersion + '-') || ver.startsWith(mcVersion + '.')) {
                    versions.push(ver);
                }
            }
            return versions.sort().reverse().slice(0, 10).map(ver => ({
                type: 'neoforge',
                mcVersion,
                loaderVersion: ver,
                installerUrl: `https://maven.neoforged.net/releases/net/neoforged/neoforge/${ver}/neoforge-${ver}-installer.jar`,
                mainClass: 'net.neoforged.bootstrap.Main',
            }));
        }
        catch {
            return [];
        }
    }
    async fetchNeoForgeFromPromos(mcVersion) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const resp = await fetch('https://raw.githubusercontent.com/neoforged/NeoForge/refs/heads/main/versions.json');
            if (!resp.ok)
                return [];
            const data = await resp.json();
            const versions = [];
            if (data.promos) {
                const seen = new Set();
                for (const [key, val] of Object.entries(data.promos)) {
                    const dotParts = key.split('.');
                    const verNum = dotParts.length >= 2 ? `${dotParts[0]}.${dotParts[1]}` : '';
                    if (!verNum || verNum !== mcVersion.split('.')[0] + '.' + mcVersion.split('.')[1])
                        continue;
                    const loaderVer = val;
                    if (!seen.has(loaderVer)) {
                        seen.add(loaderVer);
                        const fullVersion = `${mcVersion}-${loaderVer}`;
                        versions.push({
                            type: 'neoforge',
                            mcVersion,
                            loaderVersion: fullVersion,
                            installerUrl: `https://maven.neoforged.net/releases/net/neoforged/neoforge/${fullVersion}/neoforge-${fullVersion}-installer.jar`,
                            mainClass: 'net.neoforged.bootstrap.Main',
                        });
                    }
                }
            }
            return versions.sort((a, b) => b.loaderVersion.localeCompare(a.loaderVersion));
        }
        catch {
            return [];
        }
    }
    async fetchFabricVersions(mcVersion) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const resp = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
            if (!resp.ok)
                return [];
            const data = await resp.json();
            if (!data || data.length === 0)
                return [];
            const installerResp = await fetch('https://meta.fabricmc.net/v2/versions/installer');
            const installers = installerResp.ok ? await installerResp.json() : [];
            const latestInstaller = installers.find((i) => i.stable) || installers[0];
            return data.map((v) => ({
                type: 'fabric',
                mcVersion,
                loaderVersion: v.loader.version,
                installerUrl: latestInstaller
                    ? `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${v.loader.version}/${latestInstaller.version}/profile/json`
                    : '',
                mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient',
            }));
        }
        catch {
            return [];
        }
    }
    async fetchQuiltVersions(mcVersion) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const resp = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`);
            if (!resp.ok)
                return [];
            const data = await resp.json();
            if (!data || data.length === 0)
                return [];
            return data.map((v) => ({
                type: 'quilt',
                mcVersion,
                loaderVersion: v.loader.version,
                installerUrl: `https://meta.quiltmc.org/v3/versions/loader/${mcVersion}/${v.loader.version}/profile/json`,
                mainClass: 'org.quiltmc.loader.impl.launch.knot.KnotClient',
            }));
        }
        catch {
            return [];
        }
    }
    async fetchOptiFineVersions(mcVersion) {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const resp = await fetch('https://optifine.net/downloads');
            if (!resp.ok)
                return [];
            const html = await resp.text();
            const releases = [];
            const lines = html.split('\n');
            for (const line of lines) {
                const match = line.match(/href="\/downloadx\?f=OptiFine_([^"]+?)"/);
                if (match) {
                    const fullVer = match[1].replace('.jar', '');
                    const mcFromVer = fullVer.split('_')[0];
                    if (mcFromVer === mcVersion) {
                        releases.push({
                            version: fullVer,
                            mirror: `https://optifine.net/downloadx?f=OptiFine_${fullVer}.jar`,
                        });
                    }
                }
            }
            return releases.slice(0, 5).map(r => ({
                type: 'optifine',
                mcVersion,
                loaderVersion: r.version,
                installerUrl: r.mirror,
                mainClass: 'net.minecraft.client.main.Main',
            }));
        }
        catch {
            return [];
        }
    }
    async fetchAllLoaders(mcVersion) {
        const [forge, neoforge, fabric, quilt, optifine] = await Promise.all([
            this.fetchForgeVersions(mcVersion).catch(() => []),
            this.fetchNeoForgeVersions(mcVersion).catch(() => []),
            this.fetchFabricVersions(mcVersion).catch(() => []),
            this.fetchQuiltVersions(mcVersion).catch(() => []),
            this.fetchOptiFineVersions(mcVersion).catch(() => []),
        ]);
        return { forge, neoforge, fabric, quilt, optifine };
    }
    async installModLoader(type, mcVersion, loaderVersion) {
        const emit = (progress, message) => {
            this.emit('progress', {
                versionId: `${type}-${mcVersion}-${loaderVersion}`,
                status: progress >= 100 ? 'done' : 'downloading',
                progress,
                message,
            });
        };
        try {
            emit(5, `Installing ${type} ${loaderVersion} for MC ${mcVersion}...`);
            const profileName = `${type}-${mcVersion}-${loaderVersion}`;
            const versionDir = path.join(this.mcBasePath, 'versions', profileName);
            if (!fs.existsSync(versionDir))
                fs.mkdirSync(versionDir, { recursive: true });
            let mainClass = 'net.minecraft.client.main.Main';
            let libraries = [];
            if (type === 'fabric' || type === 'quilt') {
                emit(10, `Fetching ${type} profile...`);
                const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
                const metaBase = type === 'fabric'
                    ? 'https://meta.fabricmc.net/v2'
                    : 'https://meta.quiltmc.org/v3';
                const installerResp = await fetch(`${metaBase}/versions/installer`);
                const installers = installerResp.ok ? await installerResp.json() : [];
                const installer = installers.find((i) => i.stable) || installers[0];
                if (!installer)
                    throw new Error('No installer found');
                const profileUrl = `${metaBase}/versions/loader/${mcVersion}/${loaderVersion}/${installer.version}/profile/json`;
                const profileResp = await fetch(profileUrl);
                if (!profileResp.ok)
                    throw new Error(`Failed to fetch ${type} profile`);
                const profile = await profileResp.json();
                mainClass = profile.mainClass || mainClass;
                libraries = profile.libraries || [];
                emit(30, `Downloading ${type} libraries...`);
                for (const lib of libraries) {
                    if (lib.url && lib.name) {
                        const libPath = this.mavenToPath(lib.name);
                        const dest = path.join(this.mcBasePath, 'libraries', libPath);
                        if (!fs.existsSync(dest)) {
                            try {
                                const fileResp = await fetch(lib.url + libPath);
                                if (fileResp.ok) {
                                    const buf = Buffer.from(await fileResp.arrayBuffer());
                                    const dir = path.dirname(dest);
                                    if (!fs.existsSync(dir))
                                        fs.mkdirSync(dir, { recursive: true });
                                    fs.writeFileSync(dest, buf);
                                }
                            }
                            catch { }
                        }
                    }
                }
                const profileJsonPath = path.join(versionDir, `${profileName}.json`);
                profile.id = profileName;
                fs.writeFileSync(profileJsonPath, JSON.stringify(profile, null, 2));
                emit(100, `${type} ${loaderVersion} installed for MC ${mcVersion}`);
                return {
                    success: true,
                    installed: { type, mcVersion, loaderVersion, profileName, mainClass, libraries },
                };
            }
            if (type === 'forge') {
                const mavenBase = 'https://maven.minecraftforge.net';
                const mavenPath = `net/minecraftforge/forge/${loaderVersion}`;
                emit(15, 'Downloading Forge installer...');
                const installerUrl = `${mavenBase}/${mavenPath}/forge-${loaderVersion}-installer.jar`;
                const installerDest = path.join(versionDir, `${profileName}-installer.jar`);
                await this.downloadFile(installerUrl, installerDest);
                // Forge since 1.13+ uses a different launch setup with the userdev jar
                mainClass = 'net.minecraftforge.bootstrap.ForgeBootstrap';
                const mavenUrl = `${mavenBase}/`;
                const libEntry = {
                    name: `net.minecraftforge:forge:${loaderVersion}`,
                    url: mavenUrl,
                    downloads: {
                        artifact: {
                            path: `${mavenPath}/forge-${loaderVersion}.jar`,
                            url: `${mavenBase}/${mavenPath}/forge-${loaderVersion}.jar`,
                            sha1: '',
                            size: 0,
                        },
                    },
                };
                const profileJson = {
                    id: profileName,
                    inheritsFrom: mcVersion,
                    mainClass,
                    libraries: [libEntry],
                    releaseTime: new Date().toISOString(),
                    time: new Date().toISOString(),
                    type: 'release',
                };
                const profileJsonPath = path.join(versionDir, `${profileName}.json`);
                fs.writeFileSync(profileJsonPath, JSON.stringify(profileJson, null, 2));
                emit(100, `Forge ${loaderVersion} installed for MC ${mcVersion}`);
                return {
                    success: true,
                    installed: { type, mcVersion, loaderVersion, profileName, mainClass, libraries: [libEntry] },
                };
            }
            if (type === 'neoforge') {
                const mavenBase = 'https://maven.neoforged.net/releases';
                const mavenPath = `net/neoforged/neoforge/${loaderVersion}`;
                emit(15, 'Downloading NeoForge installer...');
                const installerUrl = `${mavenBase}/${mavenPath}/neoforge-${loaderVersion}-installer.jar`;
                const installerDest = path.join(versionDir, `${profileName}-installer.jar`);
                await this.downloadFile(installerUrl, installerDest);
                mainClass = 'net.neoforged.bootstrap.Main';
                const libEntry = {
                    name: `net.neoforged:neoforge:${loaderVersion}`,
                    url: `${mavenBase}/`,
                    downloads: {
                        artifact: {
                            path: `${mavenPath}/neoforge-${loaderVersion}.jar`,
                            url: `${mavenBase}/${mavenPath}/neoforge-${loaderVersion}.jar`,
                            sha1: '',
                            size: 0,
                        },
                    },
                };
                const profileJson = {
                    id: profileName,
                    inheritsFrom: mcVersion,
                    mainClass,
                    libraries: [libEntry],
                    releaseTime: new Date().toISOString(),
                    time: new Date().toISOString(),
                    type: 'release',
                };
                const profileJsonPath = path.join(versionDir, `${profileName}.json`);
                fs.writeFileSync(profileJsonPath, JSON.stringify(profileJson, null, 2));
                emit(100, `NeoForge ${loaderVersion} installed for MC ${mcVersion}`);
                return {
                    success: true,
                    installed: { type, mcVersion, loaderVersion, profileName, mainClass, libraries: [libEntry] },
                };
            }
            if (type === 'optifine') {
                emit(15, `Downloading OptiFine ${loaderVersion}...`);
                const jarUrl = `https://optifine.net/downloadx?f=OptiFine_${loaderVersion}.jar`;
                const jarDest = path.join(versionDir, `${profileName}.jar`);
                await this.downloadFile(jarUrl, jarDest);
                const profileJson = {
                    id: profileName,
                    inheritsFrom: mcVersion,
                    mainClass: 'net.minecraft.client.main.Main',
                    libraries: [],
                    releaseTime: new Date().toISOString(),
                    time: new Date().toISOString(),
                    type: 'release',
                };
                const profileJsonPath = path.join(versionDir, `${profileName}.json`);
                fs.writeFileSync(profileJsonPath, JSON.stringify(profileJson, null, 2));
                emit(100, `OptiFine ${loaderVersion} installed for MC ${mcVersion}`);
                return {
                    success: true,
                    installed: { type, mcVersion, loaderVersion, profileName, mainClass: 'net.minecraft.client.main.Main', libraries: [] },
                };
            }
            return { success: false, error: `Unsupported mod loader type: ${type}` };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async downloadFile(url, dest) {
        const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
        const resp = await fetch(url);
        if (!resp.ok)
            throw new Error(`HTTP ${resp.status} downloading ${url}`);
        const buf = Buffer.from(await resp.arrayBuffer());
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dest, buf);
    }
    mavenToPath(name) {
        const parts = name.split(':');
        if (parts.length < 3)
            return name.replace(/\./g, '/') + '.jar';
        const group = parts[0].replace(/\./g, '/');
        const artifact = parts[1];
        const version = parts[2];
        const classifier = parts.length > 3 ? `-${parts[3]}` : '';
        return `${group}/${artifact}/${version}/${artifact}-${version}${classifier}.jar`;
    }
    getInstalledLoaders() {
        const versionsDir = path.join(this.mcBasePath, 'versions');
        if (!fs.existsSync(versionsDir))
            return [];
        const loaders = [];
        try {
            const entries = fs.readdirSync(versionsDir);
            for (const entry of entries) {
                const dir = path.join(versionsDir, entry);
                if (!fs.statSync(dir).isDirectory())
                    continue;
                const jsonFile = path.join(dir, `${entry}.json`);
                if (!fs.existsSync(jsonFile))
                    continue;
                try {
                    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
                    for (const type of ['forge', 'neoforge', 'fabric', 'quilt', 'optifine']) {
                        if (entry.startsWith(type)) {
                            const rest = entry.replace(`${type}-`, '');
                            const lastDash = rest.lastIndexOf('-');
                            const mcVer = lastDash >= 0 ? rest.substring(0, lastDash) : rest;
                            const loaderVer = lastDash >= 0 ? rest.substring(lastDash + 1) : rest;
                            loaders.push({
                                type,
                                mcVersion: mcVer,
                                loaderVersion: loaderVer,
                                profileName: entry,
                                mainClass: data.mainClass || 'net.minecraft.client.main.Main',
                                libraries: data.libraries || [],
                            });
                            break;
                        }
                    }
                }
                catch { }
            }
        }
        catch { }
        return loaders;
    }
    getInstalledLoader(profileName) {
        return this.getInstalledLoaders().find(l => l.profileName === profileName) || null;
    }
    removeLoader(profileName) {
        const dir = path.join(this.mcBasePath, 'versions', profileName);
        if (fs.existsSync(dir))
            fs.rmSync(dir, { recursive: true, force: true });
    }
}
exports.ModLoadersService = ModLoadersService;
