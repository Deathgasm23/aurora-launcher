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
exports.MinecraftService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const events_1 = require("events");
const VERSION_MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
let _fetch = null;
async function getFetch() {
    if (!_fetch)
        _fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
    return _fetch;
}
class MinecraftService extends events_1.EventEmitter {
    constructor(basePath) {
        super();
        this.manifest = null;
        this.basePath = basePath;
    }
    ensureDirectories() {
        const dirs = [
            path.join(this.basePath, 'versions'),
            path.join(this.basePath, 'assets'),
            path.join(this.basePath, 'assets', 'objects'),
            path.join(this.basePath, 'assets', 'indexes'),
            path.join(this.basePath, 'libraries'),
            path.join(this.basePath, 'natives'),
        ];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
        });
    }
    async fetchManifest() {
        const response = await (await getFetch())(VERSION_MANIFEST_URL);
        if (!response.ok)
            throw new Error(`Failed to fetch version manifest: ${response.status}`);
        const data = await response.json();
        this.manifest = {
            latest: data.latest,
            versions: data.versions.map((v) => ({
                id: v.id,
                type: v.type,
                url: v.url,
                time: v.time,
                releaseTime: v.releaseTime,
                installed: false,
            })),
        };
        this.scanInstalledVersions();
        return this.manifest;
    }
    getManifestCached() {
        return this.manifest;
    }
    async checkForNewVersions() {
        const response = await (await getFetch())(VERSION_MANIFEST_URL);
        if (!response.ok)
            throw new Error(`Failed to fetch manifest: ${response.status}`);
        const data = await response.json();
        if (!this.manifest)
            return [];
        const knownIds = new Set(this.manifest.versions.map(v => v.id));
        const newVersions = [];
        for (const v of data.versions) {
            if (!knownIds.has(v.id))
                newVersions.push(v.id);
        }
        if (newVersions.length > 0) {
            this.manifest = {
                latest: data.latest,
                versions: data.versions.map((v) => ({
                    id: v.id,
                    type: v.type,
                    url: v.url,
                    time: v.time,
                    releaseTime: v.releaseTime,
                    installed: knownIds.has(v.id) && (this.manifest?.versions.find(mv => mv.id === v.id)?.installed || false),
                })),
            };
            this.scanInstalledVersions();
        }
        return newVersions;
    }
    async fetchVersionJson(versionId) {
        if (!this.manifest)
            await this.fetchManifest();
        const version = this.manifest.versions.find(v => v.id === versionId);
        if (!version)
            throw new Error(`Version ${versionId} not found in manifest`);
        const response = await (await getFetch())(version.url);
        if (!response.ok)
            throw new Error(`Failed to fetch version JSON: ${response.status}`);
        return response.json();
    }
    getInstalledVersions() {
        const versionsDir = path.join(this.basePath, 'versions');
        if (!fs.existsSync(versionsDir))
            return [];
        try {
            return fs.readdirSync(versionsDir).filter(entry => {
                const dir = path.join(versionsDir, entry);
                return fs.statSync(dir).isDirectory();
            });
        }
        catch {
            return [];
        }
    }
    scanInstalledVersions() {
        if (!this.manifest)
            return;
        const installed = this.getInstalledVersions();
        for (const version of this.manifest.versions) {
            version.installed = installed.includes(version.id);
        }
    }
    async installVersion(versionId) {
        this.ensureDirectories();
        const versionDir = path.join(this.basePath, 'versions', versionId);
        if (!fs.existsSync(versionDir))
            fs.mkdirSync(versionDir, { recursive: true });
        this.emit('progress', {
            versionId, status: 'downloading', progress: 0,
            message: `Starting installation of ${versionId}...`,
        });
        const versionJson = await this.fetchVersionJson(versionId);
        this.emit('progress', {
            versionId, status: 'downloading', progress: 5,
            message: 'Downloading version JSON...',
        });
        fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(versionJson, null, 2));
        this.emit('progress', {
            versionId, status: 'downloading', progress: 10,
            message: 'Downloading client jar + assets index...',
        });
        await Promise.all([
            this.downloadWithVerify(versionJson.downloads.client.url, path.join(versionDir, `${versionId}.jar`), versionJson.downloads.client.sha1),
            this.downloadAssetIndex(versionJson.assetIndex),
        ]);
        this.emit('progress', {
            versionId, status: 'downloading', progress: 35,
            message: 'Downloading assets...',
        });
        await this.downloadAssets(versionJson.assetIndex, versionId);
        this.emit('progress', {
            versionId, status: 'downloading', progress: 45,
            message: 'Downloading libraries...',
        });
        await this.downloadLibraries(versionJson.libraries, versionId);
        this.emit('progress', {
            versionId, status: 'done', progress: 100,
            message: `${versionId} installed successfully!`,
        });
        if (this.manifest) {
            const v = this.manifest.versions.find(v => v.id === versionId);
            if (v)
                v.installed = true;
        }
    }
    deleteVersion(versionId) {
        const versionDir = path.join(this.basePath, 'versions', versionId);
        if (fs.existsSync(versionDir))
            fs.rmSync(versionDir, { recursive: true, force: true });
    }
    async downloadWithVerify(url, destPath, expectedSha1, retries = 3) {
        if (expectedSha1 && fs.existsSync(destPath)) {
            try {
                const fileBuffer = fs.readFileSync(destPath);
                const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex');
                if (hash === expectedSha1)
                    return;
            }
            catch { }
        }
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const response = await (await getFetch())(url);
                if (!response.ok)
                    throw new Error(`HTTP ${response.status}`);
                const buffer = Buffer.from(await response.arrayBuffer());
                if (expectedSha1) {
                    const hash = crypto.createHash('sha1').update(buffer).digest('hex');
                    if (hash !== expectedSha1) {
                        throw new Error(`SHA1 mismatch for ${path.basename(destPath)}`);
                    }
                }
                const dir = path.dirname(destPath);
                if (!fs.existsSync(dir))
                    fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(destPath, buffer);
                return;
            }
            catch (err) {
                if (attempt === retries - 1)
                    throw err;
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
    async downloadAssetIndex(assetIndex) {
        const indexPath = path.join(this.basePath, 'assets', 'indexes', `${assetIndex.id}.json`);
        if (fs.existsSync(indexPath)) {
            try {
                const fileBuffer = fs.readFileSync(indexPath);
                const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex');
                if (hash === assetIndex.sha1)
                    return;
            }
            catch { }
        }
        await this.downloadWithVerify(assetIndex.url, indexPath, assetIndex.sha1);
    }
    async runConcurrent(items, concurrency, fn) {
        let idx = 0;
        let active = 0;
        let completed = 0;
        const total = items.length;
        const errors = [];
        return new Promise((resolve) => {
            const next = () => {
                while (idx < total && active < concurrency) {
                    const i = idx++;
                    active++;
                    fn(items[i])
                        .catch((err) => errors.push(err))
                        .finally(() => {
                        active--;
                        completed++;
                        if (completed === total)
                            resolve();
                        else
                            next();
                    });
                }
            };
            next();
        }).then(() => {
            if (errors.length > 0)
                console.warn(`${errors.length} concurrent downloads failed`);
        });
    }
    async downloadAssets(assetIndex, versionId) {
        const indexPath = path.join(this.basePath, 'assets', 'indexes', `${assetIndex.id}.json`);
        if (!fs.existsSync(indexPath))
            return;
        let raw;
        try {
            raw = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        }
        catch {
            return;
        }
        const objects = raw.objects || raw;
        const entries = Object.entries(objects).filter(([, info]) => info?.hash);
        const baseUrl = 'https://resources.download.minecraft.net';
        const total = entries.length;
        let done = 0, skipped = 0;
        const concurrency = 20;
        const emitProgress = () => {
            const pct = total > 0 ? Math.round((done + skipped) / total * 100) : 100;
            if (versionId) {
                this.emit('progress', {
                    versionId, status: 'downloading',
                    progress: 35 + Math.round(pct * 0.35),
                    message: `Downloading assets... ${done} new, ${skipped} cached (${total} total)`,
                });
            }
        };
        await this.runConcurrent(entries, concurrency, async ([, info]) => {
            const hash = info.hash;
            const subDir = hash.substring(0, 2);
            const destPath = path.join(this.basePath, 'assets', 'objects', subDir, hash);
            if (fs.existsSync(destPath)) {
                skipped++;
                return;
            }
            try {
                await this.downloadWithVerify(`${baseUrl}/${subDir}/${hash}`, destPath, hash);
                done++;
            }
            catch {
                skipped++;
            }
            emitProgress();
        });
        emitProgress();
    }
    async downloadLibraries(libraries, versionId) {
        const isWin = process.platform === 'win32';
        const isLin = process.platform === 'linux';
        const isMac = process.platform === 'darwin';
        const downloads = [];
        for (const lib of libraries) {
            if (lib.downloads?.artifact) {
                const a = lib.downloads.artifact;
                downloads.push({ url: a.url, dest: path.join(this.basePath, 'libraries', ...a.path.split('/')), sha1: a.sha1 });
            }
            if (lib.natives && lib.downloads?.classifiers) {
                for (const os of Object.keys(lib.natives)) {
                    let classifier = lib.natives[os];
                    if (isWin && os === 'windows') {
                        classifier = classifier.replace('${arch}', process.arch === 'x64' ? '64' : '32');
                    }
                    else if (!((isWin && os === 'windows') || (isLin && os === 'linux') || (isMac && os === 'osx'))) {
                        continue;
                    }
                    const entry = lib.downloads.classifiers[classifier];
                    if (entry)
                        downloads.push({ url: entry.url, dest: path.join(this.basePath, 'natives', classifier), sha1: entry.sha1 });
                }
            }
        }
        const concurrency = 20;
        const total = downloads.length;
        let done = 0;
        await this.runConcurrent(downloads, concurrency, async ({ url, dest, sha1 }) => {
            try {
                await this.downloadWithVerify(url, dest, sha1);
            }
            catch (err) {
                console.warn(`Failed to download ${path.basename(dest)}:`, err);
            }
            done++;
            if (versionId) {
                const pct = Math.round(done / total * 100);
                this.emit('progress', {
                    versionId, status: 'downloading',
                    progress: 70 + Math.round(pct * 0.20),
                    message: `Downloading libraries... ${done}/${total}`,
                });
            }
        });
    }
}
exports.MinecraftService = MinecraftService;
