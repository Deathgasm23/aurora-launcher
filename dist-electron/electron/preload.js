"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
function onLaunchOutput(callback) {
    electron_1.ipcRenderer.on('launch:output', (_event, data) => callback(data));
}
function removeLaunchOutputListener() {
    electron_1.ipcRenderer.removeAllListeners('launch:output');
}
function onLaunchError(callback) {
    electron_1.ipcRenderer.on('launch:error', (_event, data) => callback(data));
}
function removeLaunchErrorListener() {
    electron_1.ipcRenderer.removeAllListeners('launch:error');
}
function onLaunchExit(callback) {
    electron_1.ipcRenderer.on('launch:exit', (_event, code) => callback(code));
}
function removeLaunchExitListener() {
    electron_1.ipcRenderer.removeAllListeners('launch:exit');
}
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    auth: {
        loginOffline: (username) => electron_1.ipcRenderer.invoke('auth:login-offline', username),
        logout: (accountId) => electron_1.ipcRenderer.invoke('auth:logout', accountId),
        getAccounts: () => electron_1.ipcRenderer.invoke('auth:get-accounts'),
        setCurrentAccount: (accountId) => electron_1.ipcRenderer.invoke('auth:set-current', accountId),
        getCurrentAccount: () => electron_1.ipcRenderer.invoke('auth:get-current'),
    },
    versions: {
        getManifest: () => electron_1.ipcRenderer.invoke('versions:get-manifest'),
        getVersionJson: (versionId) => electron_1.ipcRenderer.invoke('versions:get-json', versionId),
        installVersion: (versionId) => electron_1.ipcRenderer.invoke('versions:install', versionId),
        deleteVersion: (versionId) => electron_1.ipcRenderer.invoke('versions:delete', versionId),
        reinstallVersion: (versionId) => electron_1.ipcRenderer.invoke('versions:reinstall', versionId),
        getInstalledVersions: () => electron_1.ipcRenderer.invoke('versions:get-installed'),
        onInstallProgress: (callback) => {
            electron_1.ipcRenderer.on('versions:install-progress', (_event, progress) => callback(progress));
        },
        removeInstallProgressListener: () => {
            electron_1.ipcRenderer.removeAllListeners('versions:install-progress');
        },
        onNewVersions: (callback) => {
            electron_1.ipcRenderer.on('versions:new-versions', (_event, versions) => callback(versions));
        },
        removeNewVersionsListener: () => {
            electron_1.ipcRenderer.removeAllListeners('versions:new-versions');
        },
    },
    launch: {
        launchGame: (accountId, versionId) => electron_1.ipcRenderer.invoke('launch:game', accountId, versionId),
        getJavaInstallations: () => electron_1.ipcRenderer.invoke('launch:get-java'),
        validateJava: (javaPath) => electron_1.ipcRenderer.invoke('launch:validate-java', javaPath),
        setLastVersion: (versionId) => electron_1.ipcRenderer.invoke('launch:set-last-version', versionId),
        launchGameWithJava: (accountId, versionId, javaPath) => electron_1.ipcRenderer.invoke('launch:game', accountId, versionId, javaPath),
        launchGameWithExtras: (accountId, versionId, extras) => electron_1.ipcRenderer.invoke('launch:game-with-extras', accountId, versionId, extras),
    },
    settings: {
        get: () => electron_1.ipcRenderer.invoke('settings:get'),
        set: (settings) => electron_1.ipcRenderer.invoke('settings:set', settings),
        getDefault: () => electron_1.ipcRenderer.invoke('settings:get-default'),
        getPath: () => electron_1.ipcRenderer.invoke('settings:get-path'),
        exportSettings: () => electron_1.ipcRenderer.invoke('settings:export'),
        importSettings: () => electron_1.ipcRenderer.invoke('settings:import'),
    },
    news: {
        getNews: () => electron_1.ipcRenderer.invoke('news:get'),
    },
    logs: {
        getLogs: () => electron_1.ipcRenderer.invoke('logs:get'),
        clearLogs: () => electron_1.ipcRenderer.invoke('logs:clear'),
    },
    client: {
        getStatus: () => electron_1.ipcRenderer.invoke('client:get-status'),
    },
    window: {
        minimize: () => electron_1.ipcRenderer.send('window:minimize'),
        maximize: () => electron_1.ipcRenderer.send('window:maximize'),
        close: () => electron_1.ipcRenderer.send('window:close'),
    },
    app: {
        getVersion: () => electron_1.ipcRenderer.invoke('app:get-version'),
        checkForUpdates: () => electron_1.ipcRenderer.invoke('app:check-updates'),
    },
    update: {
        check: () => electron_1.ipcRenderer.invoke('update:check'),
        download: () => electron_1.ipcRenderer.invoke('update:download'),
        install: () => electron_1.ipcRenderer.invoke('update:install'),
        onChecking: (callback) => { electron_1.ipcRenderer.on('update:checking', () => callback()); },
        onAvailable: (callback) => { electron_1.ipcRenderer.on('update:available', (_event, info) => callback(info)); },
        onNotAvailable: (callback) => { electron_1.ipcRenderer.on('update:not-available', (_event, info) => callback(info)); },
        onDownloadProgress: (callback) => { electron_1.ipcRenderer.on('update:download-progress', (_event, progress) => callback(progress)); },
        onDownloaded: (callback) => { electron_1.ipcRenderer.on('update:downloaded', (_event, info) => callback(info)); },
        onError: (callback) => { electron_1.ipcRenderer.on('update:error', (_event, message) => callback(message)); },
    },
    servers: {
        list: () => electron_1.ipcRenderer.invoke('servers:list'),
        save: (servers) => electron_1.ipcRenderer.invoke('servers:save', servers),
        ping: (address, port) => electron_1.ipcRenderer.invoke('servers:ping', address, port),
    },
    screenshots: {
        list: () => electron_1.ipcRenderer.invoke('screenshots:list'),
        open: () => electron_1.ipcRenderer.invoke('screenshots:open'),
    },
    playtime: {
        getStats: () => electron_1.ipcRenderer.invoke('playtime:stats'),
    },
    crashReports: {
        list: () => electron_1.ipcRenderer.invoke('crash-reports:list'),
        get: (filePath) => electron_1.ipcRenderer.invoke('crash-reports:get', filePath),
    },
    shell: {
        openPath: (filePath) => electron_1.ipcRenderer.invoke('shell:open-path', filePath),
        openExternal: (url) => electron_1.ipcRenderer.invoke('shell:open-external', url),
        openSettingsFolder: () => electron_1.ipcRenderer.invoke('settings:open-folder'),
        selectFolder: () => electron_1.ipcRenderer.invoke('settings:select-folder'),
    },
    onLaunchOutput,
    removeLaunchOutputListener,
    onLaunchError,
    removeLaunchErrorListener,
    onLaunchExit,
    removeLaunchExitListener,
});
