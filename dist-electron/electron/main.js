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
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const electron_updater_1 = require("electron-updater");
electron_1.app.name = 'Aurora Launcher';
const auth_service_1 = require("./services/auth.service");
const minecraft_service_1 = require("./services/minecraft.service");
const launch_service_1 = require("./services/launch.service");
const settings_service_1 = require("./services/settings.service");
const java_service_1 = require("./services/java.service");
const news_service_1 = require("./services/news.service");
const logs_service_1 = require("./services/logs.service");
const playtime_service_1 = require("./services/playtime.service");
const REPO_OWNER = 'Deathgasm23';
const REPO_NAME = 'aurora-launcher';
let mainWindow = null;
let tray = null;
let isQuitting = false;
let authService;
let minecraftService;
let launchService;
let settingsService;
let javaService;
let newsService;
let logsService;
let playtimeService;
function writeVarInt(value, buf, offset) {
    while (true) {
        if ((value & ~0x7F) === 0) {
            buf.writeUInt8(value, offset);
            return offset + 1;
        }
        buf.writeUInt8((value & 0x7F) | 0x80, offset);
        offset++;
        value >>>= 7;
    }
}
function readVarInt(buf, offset) {
    let value = 0, size = 0;
    while (true) {
        const byte = buf.readUInt8(offset + size);
        value |= (byte & 0x7F) << (size * 7);
        size++;
        if ((byte & 0x80) === 0)
            return { value, size };
        if (size > 5)
            throw new Error('VarInt too big');
    }
}
const pingMinecraftServer = (host, port) => {
    return new Promise((resolve) => {
        const net = require('net');
        const startTime = Date.now();
        const socket = new net.Socket();
        let data = Buffer.alloc(0);
        let resolved = false;
        const done = (result) => {
            if (resolved)
                return;
            resolved = true;
            clearTimeout(timer);
            socket.destroy();
            resolve(result);
        };
        const timer = setTimeout(() => done({ online: false, latency: Date.now() - startTime }), 4000);
        socket.setTimeout(4000);
        socket.on('timeout', () => done({ online: false, latency: Date.now() - startTime }));
        socket.connect(port, host, () => {
            const hostBytes = Buffer.from(host, 'utf-8');
            const buf = Buffer.alloc(hostBytes.length + 10);
            let off = 0;
            off = writeVarInt(0, buf, off);
            off = writeVarInt(-1, buf, off);
            off = writeVarInt(hostBytes.length, buf, off);
            hostBytes.copy(buf, off);
            off += hostBytes.length;
            buf.writeUInt16BE(port, off);
            off += 2;
            off = writeVarInt(1, buf, off);
            const header = Buffer.alloc(5);
            const hLen = writeVarInt(off, header, 0);
            socket.write(Buffer.concat([header.subarray(0, hLen), buf.subarray(0, off)]));
            socket.write(Buffer.from([1, 0]));
        });
        socket.on('data', (chunk) => {
            data = Buffer.concat([data, chunk]);
            try {
                const { value: pktLen, size: pktLenSize } = readVarInt(data, 0);
                if (data.length >= pktLen + pktLenSize) {
                    const { value: pktId, size: pktIdSize } = readVarInt(data, pktLenSize);
                    if (pktId === 0) {
                        const { value: jsonLen, size: jsonLenSize } = readVarInt(data, pktLenSize + pktIdSize);
                        if (data.length >= pktLenSize + pktIdSize + jsonLenSize + jsonLen) {
                            const jsonStr = data.subarray(pktLenSize + pktIdSize + jsonLenSize, pktLenSize + pktIdSize + jsonLenSize + jsonLen).toString('utf-8');
                            const json = JSON.parse(jsonStr);
                            const motd = json.description?.text || (typeof json.description === 'string' ? json.description : undefined) ||
                                (json.description?.extra ? json.description.extra.map((e) => e.text || '').join('') : JSON.stringify(json.description));
                            return done({
                                online: true, motd,
                                players: json.players ? { online: json.players.online, max: json.players.max } : undefined,
                                version: json.version?.name, protocol: json.version?.protocol,
                                latency: Date.now() - startTime, icon: json.favicon,
                            });
                        }
                    }
                }
            }
            catch { }
            try {
                if (data.length >= 3 && data[0] === 0xFF) {
                    const len = data.readUInt16BE(1);
                    if (data.length >= 3 + len) {
                        const buf = Buffer.from(data.subarray(3, 3 + len));
                        buf.swap16();
                        const str = buf.toString('utf16le');
                        const parts = str.split('\u00a7');
                        if (parts.length >= 6) {
                            return done({
                                online: true, motd: parts[3],
                                players: { online: parseInt(parts[4]) || 0, max: parseInt(parts[5]) || 0 },
                                version: parts[2], latency: Date.now() - startTime,
                            });
                        }
                    }
                }
            }
            catch { }
        });
        socket.on('error', () => done({ online: false, latency: Date.now() - startTime }));
    });
};
const setupAutoUpdater = () => {
    electron_updater_1.autoUpdater.autoDownload = false;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = true;
    electron_updater_1.autoUpdater.setFeedURL({
        provider: 'github',
        owner: REPO_OWNER,
        repo: REPO_NAME,
    });
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
        mainWindow?.webContents.send('update:checking');
    });
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        logsService.add('info', `Update available: ${info.version}`, 'updater');
        mainWindow?.webContents.send('update:available', info);
    });
    electron_updater_1.autoUpdater.on('update-not-available', (info) => {
        mainWindow?.webContents.send('update:not-available', info);
    });
    electron_updater_1.autoUpdater.on('download-progress', (progress) => {
        mainWindow?.webContents.send('update:download-progress', progress);
    });
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
        logsService.add('info', `Update downloaded: ${info.version}`, 'updater');
        mainWindow?.webContents.send('update:downloaded', info);
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        const msg = err.message || '';
        const shortMsg = msg.replace(/\\n/g, '\n').split('\n')[0].trim();
        // Silently handle 404 / no-releases — expected before first publish
        if (/404|No release|not found|Cannot find latest\.yml/i.test(shortMsg)) {
            mainWindow?.webContents.send('update:not-available', null);
            return;
        }
        logsService.add('error', `Update error: ${shortMsg}`, 'updater');
        const sanitized = shortMsg.length > 80 ? shortMsg.slice(0, 80) + '...' : shortMsg;
        mainWindow?.webContents.send('update:error', sanitized);
    });
};
function setupTray() {
    const iconPath = path.join(__dirname, 'icon.png');
    const icon = electron_1.nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new electron_1.Tray(icon);
    tray.setToolTip('Aurora Launcher');
    tray.setContextMenu(electron_1.Menu.buildFromTemplate([
        { label: 'Show Aurora Launcher', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
        { type: 'separator' },
        { label: 'Quit', click: () => { isQuitting = true; electron_1.app.quit(); } },
    ]));
    tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    });
    if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
}
function setupIPCHandlers() {
    // auth
    electron_1.ipcMain.handle('auth:login-offline', (_event, username) => {
        return authService.loginOffline(username);
    });
    electron_1.ipcMain.handle('auth:logout', (_event, accountId) => {
        authService.removeAccount(accountId);
    });
    electron_1.ipcMain.handle('auth:get-accounts', () => {
        return authService.getAccounts();
    });
    electron_1.ipcMain.handle('auth:set-current', (_event, accountId) => {
        authService.setCurrentAccount(accountId);
    });
    electron_1.ipcMain.handle('auth:get-current', () => {
        return authService.getCurrentAccount();
    });
    // versions
    electron_1.ipcMain.handle('versions:get-manifest', () => {
        return minecraftService.fetchManifest();
    });
    electron_1.ipcMain.handle('versions:get-json', (_event, versionId) => {
        return minecraftService.fetchVersionJson(versionId);
    });
    electron_1.ipcMain.handle('versions:install', (_event, versionId) => {
        return minecraftService.installVersion(versionId)
            .then(() => ({ success: true }))
            .catch((err) => ({ success: false, error: err.message }));
    });
    electron_1.ipcMain.handle('versions:delete', (_event, versionId) => {
        try {
            minecraftService.deleteVersion(versionId);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('versions:reinstall', (_event, versionId) => {
        try {
            minecraftService.deleteVersion(versionId);
            return minecraftService.installVersion(versionId)
                .then(() => ({ success: true }))
                .catch((err) => ({ success: false, error: err.message }));
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('versions:get-installed', () => {
        return minecraftService.getInstalledVersions();
    });
    minecraftService.on('progress', (progress) => {
        if (mainWindow)
            mainWindow.webContents.send('versions:install-progress', progress);
    });
    // launch
    electron_1.ipcMain.handle('launch:game', async (_event, accountId, versionId, javaOverride) => {
        const account = authService.getAccounts().find(a => a.id === accountId);
        if (!account)
            return { success: false, error: 'Account not found' };
        const manifest = minecraftService.getManifestCached();
        const version = manifest?.versions.find(v => v.id === versionId);
        if (!version)
            return { success: false, error: 'Version not found' };
        const settings = { ...settingsService.get() };
        if (javaOverride)
            settings.javaPath = javaOverride;
        const versionJson = await minecraftService.fetchVersionJson(versionId);
        logsService.clear();
        logsService.add('info', `Launching Minecraft ${versionId}...`, 'main');
        const launchStart = Date.now();
        try {
            launchService.on('output', (data) => {
                logsService.add('info', data.trimEnd(), 'game');
                mainWindow?.webContents.send('launch:output', data);
            });
            launchService.on('error', (data) => {
                logsService.add('error', data.trimEnd(), 'game');
                mainWindow?.webContents.send('launch:error', data);
            });
            launchService.on('exit', (code) => {
                const duration = Date.now() - launchStart;
                playtimeService.recordSession(account.id, account.username, versionId, launchStart, duration);
                logsService.add('info', `Game exited with code ${code} (played ${Math.round(duration / 1000)}s)`, 'game');
                mainWindow?.webContents.send('launch:exit', code);
            });
            mainWindow?.hide();
            await launchService.launchGame({ account, version, settings, versionJson });
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('launch:set-last-version', (_event, versionId) => {
        const s = settingsService.get();
        s.lastVersion = versionId;
        settingsService.update(s);
    });
    electron_1.ipcMain.handle('launch:get-java', () => {
        return javaService.detectInstallations();
    });
    electron_1.ipcMain.handle('launch:validate-java', (_event, javaPath) => {
        return javaService.validateJava(javaPath);
    });
    electron_1.ipcMain.handle('launch:game-with-extras', async (_event, accountId, versionId, extras) => {
        const account = authService.getAccounts().find(a => a.id === accountId);
        if (!account)
            return { success: false, error: 'Account not found' };
        const manifest = minecraftService.getManifestCached();
        const version = manifest?.versions.find(v => v.id === versionId);
        if (!version)
            return { success: false, error: 'Version not found' };
        const settings = { ...settingsService.get() };
        const versionJson = await minecraftService.fetchVersionJson(versionId);
        logsService.clear();
        logsService.add('info', `Launching Minecraft ${versionId}...`, 'main');
        const launchStart = Date.now();
        try {
            launchService.on('output', (data) => {
                logsService.add('info', data.trimEnd(), 'game');
                mainWindow?.webContents.send('launch:output', data);
            });
            launchService.on('error', (data) => {
                logsService.add('error', data.trimEnd(), 'game');
                mainWindow?.webContents.send('launch:error', data);
            });
            launchService.on('exit', (code) => {
                const duration = Date.now() - launchStart;
                playtimeService.recordSession(account.id, account.username, versionId, launchStart, duration);
                logsService.add('info', `Game exited with code ${code} (played ${Math.round(duration / 1000)}s)`, 'game');
                mainWindow?.webContents.send('launch:exit', code);
            });
            mainWindow?.hide();
            await launchService.launchGame({ account, version, settings, versionJson, extras });
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('playtime:stats', () => playtimeService.getStats());
    electron_1.ipcMain.handle('settings:get', () => settingsService.get());
    electron_1.ipcMain.handle('settings:set', (_event, newSettings) => settingsService.update(newSettings));
    electron_1.ipcMain.handle('settings:get-default', () => settingsService.getDefaults());
    electron_1.ipcMain.handle('settings:get-path', () => settingsService.getSettingsPath());
    electron_1.ipcMain.handle('settings:export', async () => {
        const { dialog } = require('electron');
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Settings',
            defaultPath: 'aurora-settings.json',
            filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (result.canceled || !result.filePath)
            return { success: false };
        try {
            const settings = settingsService.get();
            require('fs').writeFileSync(result.filePath, JSON.stringify(settings, null, 2), 'utf-8');
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:import', async () => {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Settings',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile'],
        });
        if (result.canceled || result.filePaths.length === 0)
            return { success: false };
        try {
            const parsed = JSON.parse(require('fs').readFileSync(result.filePaths[0], 'utf-8'));
            settingsService.update(parsed);
            return { success: true, settings: settingsService.get() };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('settings:open-folder', async () => {
        electron_1.shell.openPath(require('path').dirname(settingsService.getSettingsPath()));
    });
    electron_1.ipcMain.handle('settings:select-folder', async () => {
        const { dialog } = require('electron');
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Minecraft Directory',
            properties: ['openDirectory'],
        });
        if (result.canceled || result.filePaths.length === 0)
            return { success: false };
        return { success: true, path: result.filePaths[0] };
    });
    electron_1.ipcMain.handle('news:get', () => {
        return newsService.fetchNews();
    });
    electron_1.ipcMain.handle('logs:get', () => logsService.getLogs());
    electron_1.ipcMain.handle('logs:clear', () => logsService.clear());
    electron_1.ipcMain.handle('shell:open-path', (_event, filePath) => {
        electron_1.shell.openPath(filePath);
    });
    electron_1.ipcMain.handle('shell:open-external', (_event, url) => {
        electron_1.shell.openExternal(url);
    });
    // window controls
    electron_1.ipcMain.on('window:minimize', () => mainWindow?.minimize());
    electron_1.ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow?.maximize();
        }
    });
    electron_1.ipcMain.on('window:close', () => {
        isQuitting = true;
        electron_1.app.quit();
    });
    // servers
    electron_1.ipcMain.handle('servers:list', () => {
        const dataDir = electron_1.app.isPackaged ? path.join(path.dirname(electron_1.app.getPath('exe')), 'data') : electron_1.app.getPath('userData');
        try {
            const serversPath = path.join(dataDir, 'servers.json');
            if (fs.existsSync(serversPath))
                return JSON.parse(fs.readFileSync(serversPath, 'utf-8'));
        }
        catch { }
        return [];
    });
    electron_1.ipcMain.handle('servers:save', (_event, servers) => {
        const dataDir = electron_1.app.isPackaged ? path.join(path.dirname(electron_1.app.getPath('exe')), 'data') : electron_1.app.getPath('userData');
        try {
            fs.writeFileSync(path.join(dataDir, 'servers.json'), JSON.stringify(servers, null, 2), 'utf-8');
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('servers:ping', async (_event, address, port) => {
        try {
            return await pingMinecraftServer(address, port);
        }
        catch {
            return { online: false, latency: 0 };
        }
    });
    // screenshots
    electron_1.ipcMain.handle('screenshots:list', () => {
        const mcDir = settingsService.get().minecraftDirectory;
        const ssDir = path.join(mcDir, 'screenshots');
        if (!fs.existsSync(ssDir))
            return [];
        try {
            const entries = fs.readdirSync(ssDir, { withFileTypes: true });
            return entries.filter(e => e.isFile() && /\.(png|jpg|jpeg|bmp)$/i.test(e.name)).map(e => {
                const filePath = path.join(ssDir, e.name);
                const stats = fs.statSync(filePath);
                return { name: e.name, path: filePath, time: stats.mtimeMs, size: stats.size };
            }).sort((a, b) => b.time - a.time);
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle('screenshots:open', () => {
        const mcDir = settingsService.get().minecraftDirectory;
        const ssDir = path.join(mcDir, 'screenshots');
        if (!fs.existsSync(ssDir))
            fs.mkdirSync(ssDir, { recursive: true });
        electron_1.shell.openPath(ssDir);
    });
    // crash reports
    electron_1.ipcMain.handle('crash-reports:list', () => {
        const mcDir = settingsService.get().minecraftDirectory;
        const crDir = path.join(mcDir, 'crash-reports');
        if (!fs.existsSync(crDir))
            return [];
        try {
            const entries = fs.readdirSync(crDir, { withFileTypes: true });
            return entries.filter(e => e.isFile() && e.name.endsWith('.txt') || e.name.endsWith('.log')).map(e => {
                const filePath = path.join(crDir, e.name);
                const stats = fs.statSync(filePath);
                return { title: e.name, path: filePath, time: stats.mtimeMs, content: '' };
            }).sort((a, b) => b.time - a.time);
        }
        catch {
            return [];
        }
    });
    electron_1.ipcMain.handle('crash-reports:get', (_event, filePath) => {
        try {
            if (fs.existsSync(filePath))
                return { content: fs.readFileSync(filePath, 'utf-8') };
            return { content: '' };
        }
        catch {
            return { content: '' };
        }
    });
    // app
    electron_1.ipcMain.handle('app:get-version', () => electron_1.app.getVersion());
    electron_1.ipcMain.handle('client:get-status', () => {
        const manifest = minecraftService.getManifestCached();
        const installed = manifest?.versions.filter(v => v.installed) || [];
        const currentAccount = authService.getCurrentAccount();
        const javaInsts = javaService.getCachedInstallations?.() || [];
        return {
            launcherVersion: electron_1.app.getVersion(),
            installedVersions: installed.length,
            currentAccount: currentAccount?.username || null,
            javaInstallations: javaInsts.length,
            totalVersions: manifest?.versions.length || 0,
        };
    });
    electron_1.ipcMain.handle('app:check-updates', async () => {
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
            if (!response.ok)
                return { updateAvailable: false };
            const data = await response.json();
            const latestVersion = data.tag_name?.replace('v', '') || '';
            const currentVersion = electron_1.app.getVersion();
            return {
                updateAvailable: latestVersion > currentVersion && latestVersion !== currentVersion,
                version: latestVersion,
            };
        }
        catch {
            return { updateAvailable: false };
        }
    });
    // update handlers
    electron_1.ipcMain.handle('update:check', () => {
        try {
            electron_updater_1.autoUpdater.checkForUpdates();
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('update:download', () => {
        try {
            electron_updater_1.autoUpdater.downloadUpdate();
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle('update:install', () => {
        try {
            electron_updater_1.autoUpdater.quitAndInstall();
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
}
electron_1.app.whenReady().then(() => {
    const portableExe = process.env.PORTABLE_EXECUTABLE_FILE || electron_1.app.getPath('exe');
    const dataDir = electron_1.app.isPackaged
        ? path.join(path.dirname(portableExe), 'data')
        : electron_1.app.getPath('userData');
    const mcBasePath = electron_1.app.isPackaged
        ? path.join(path.dirname(portableExe), 'minecraft')
        : path.join(electron_1.app.getPath('home'), '.aurora-launcher', 'minecraft');
    authService = new auth_service_1.AuthService(dataDir);
    minecraftService = new minecraft_service_1.MinecraftService(mcBasePath);
    minecraftService.ensureDirectories();
    launchService = new launch_service_1.LaunchService();
    settingsService = new settings_service_1.SettingsService(dataDir);
    javaService = new java_service_1.JavaService();
    newsService = new news_service_1.NewsService();
    logsService = new logs_service_1.LogsService(dataDir);
    playtimeService = new playtime_service_1.PlaytimeService(dataDir);
    logsService.add('info', 'Launcher starting', 'main');
    setupIPCHandlers();
    setupAutoUpdater();
    setupTray();
    createWindow();
    setInterval(async () => {
        try {
            const newVersions = await minecraftService.checkForNewVersions();
            if (newVersions.length > 0) {
                logsService.add('info', `New versions detected: ${newVersions.join(', ')}`, 'main');
                mainWindow?.webContents.send('versions:new-versions', newVersions);
            }
        }
        catch { }
    }, 10 * 60 * 1000);
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('before-quit', () => {
    isQuitting = true;
});
electron_1.app.on('window-all-closed', () => {
    if (launchService)
        launchService.stop();
    logsService.add('info', 'Launcher shutting down', 'main');
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
