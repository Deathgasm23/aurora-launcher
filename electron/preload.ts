import { contextBridge, ipcRenderer } from 'electron'

function onLaunchOutput(callback: (data: string) => void) {
  ipcRenderer.on('launch:output', (_event, data) => callback(data))
}

function removeLaunchOutputListener() {
  ipcRenderer.removeAllListeners('launch:output')
}

function onLaunchError(callback: (data: string) => void) {
  ipcRenderer.on('launch:error', (_event, data) => callback(data))
}

function removeLaunchErrorListener() {
  ipcRenderer.removeAllListeners('launch:error')
}

function onLaunchExit(callback: (code: number) => void) {
  ipcRenderer.on('launch:exit', (_event, code) => callback(code))
}

function removeLaunchExitListener() {
  ipcRenderer.removeAllListeners('launch:exit')
}

contextBridge.exposeInMainWorld('electronAPI', {
  auth: {
    loginOffline: (username: string) => ipcRenderer.invoke('auth:login-offline', username),
    logout: (accountId: string) => ipcRenderer.invoke('auth:logout', accountId),
    getAccounts: () => ipcRenderer.invoke('auth:get-accounts'),
    setCurrentAccount: (accountId: string) => ipcRenderer.invoke('auth:set-current', accountId),
    getCurrentAccount: () => ipcRenderer.invoke('auth:get-current'),
  },
  versions: {
    getManifest: () => ipcRenderer.invoke('versions:get-manifest'),
    getVersionJson: (versionId: string) => ipcRenderer.invoke('versions:get-json', versionId),
    installVersion: (versionId: string) => ipcRenderer.invoke('versions:install', versionId),
    deleteVersion: (versionId: string) => ipcRenderer.invoke('versions:delete', versionId),
    reinstallVersion: (versionId: string) => ipcRenderer.invoke('versions:reinstall', versionId),
    getInstalledVersions: () => ipcRenderer.invoke('versions:get-installed'),
    onInstallProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('versions:install-progress', (_event, progress) => callback(progress))
    },
    removeInstallProgressListener: () => {
      ipcRenderer.removeAllListeners('versions:install-progress')
    },
    onNewVersions: (callback: (versions: string[]) => void) => {
      ipcRenderer.on('versions:new-versions', (_event, versions) => callback(versions))
    },
    removeNewVersionsListener: () => {
      ipcRenderer.removeAllListeners('versions:new-versions')
    },
  },
  launch: {
    launchGame: (accountId: string, versionId: string) =>
      ipcRenderer.invoke('launch:game', accountId, versionId),
    getJavaInstallations: () => ipcRenderer.invoke('launch:get-java'),
    validateJava: (javaPath: string) => ipcRenderer.invoke('launch:validate-java', javaPath),
    setLastVersion: (versionId: string) => ipcRenderer.invoke('launch:set-last-version', versionId),
    launchGameWithJava: (accountId: string, versionId: string, javaPath?: string) =>
      ipcRenderer.invoke('launch:game', accountId, versionId, javaPath),
    launchGameWithExtras: (accountId: string, versionId: string, extras: any) =>
      ipcRenderer.invoke('launch:game-with-extras', accountId, versionId, extras),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings: any) => ipcRenderer.invoke('settings:set', settings),
    getDefault: () => ipcRenderer.invoke('settings:get-default'),
    getPath: () => ipcRenderer.invoke('settings:get-path'),
    exportSettings: () => ipcRenderer.invoke('settings:export'),
    importSettings: () => ipcRenderer.invoke('settings:import'),
  },
  news: {
    getNews: () => ipcRenderer.invoke('news:get'),
  },
  logs: {
    getLogs: () => ipcRenderer.invoke('logs:get'),
    clearLogs: () => ipcRenderer.invoke('logs:clear'),
  },
  client: {
    getStatus: () => ipcRenderer.invoke('client:get-status'),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-updates'),
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onChecking: (callback: () => void) => { ipcRenderer.on('update:checking', () => callback()) },
    onAvailable: (callback: (info: any) => void) => { ipcRenderer.on('update:available', (_event, info) => callback(info)) },
    onNotAvailable: (callback: (info: any) => void) => { ipcRenderer.on('update:not-available', (_event, info) => callback(info)) },
    onDownloadProgress: (callback: (progress: any) => void) => { ipcRenderer.on('update:download-progress', (_event, progress) => callback(progress)) },
    onDownloaded: (callback: (info: any) => void) => { ipcRenderer.on('update:downloaded', (_event, info) => callback(info)) },
    onError: (callback: (message: string) => void) => { ipcRenderer.on('update:error', (_event, message) => callback(message)) },
  },
  saves: {
    list: () => ipcRenderer.invoke('saves:list'),
    backup: (saveName: string) => ipcRenderer.invoke('saves:backup', saveName),
    listBackups: (saveName: string) => ipcRenderer.invoke('saves:list-backups', saveName),
    restore: (backupName: string, originalName: string) =>
      ipcRenderer.invoke('saves:restore', backupName, originalName),
    deleteBackup: (backupPath: string) => ipcRenderer.invoke('saves:delete-backup', backupPath),
  },
  servers: {
    list: () => ipcRenderer.invoke('servers:list'),
    save: (servers: any[]) => ipcRenderer.invoke('servers:save', servers),
    ping: (address: string, port: number) => ipcRenderer.invoke('servers:ping', address, port),
  },
  screenshots: {
    list: () => ipcRenderer.invoke('screenshots:list'),
    open: () => ipcRenderer.invoke('screenshots:open'),
  },
  crashReports: {
    list: () => ipcRenderer.invoke('crash-reports:list'),
    get: (filePath: string) => ipcRenderer.invoke('crash-reports:get', filePath),
  },
  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('shell:open-path', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
    openSettingsFolder: () => ipcRenderer.invoke('settings:open-folder'),
    selectFolder: () => ipcRenderer.invoke('settings:select-folder'),
  },

  onLaunchOutput,
  removeLaunchOutputListener,
  onLaunchError,
  removeLaunchErrorListener,
  onLaunchExit,
  removeLaunchExitListener,
})
