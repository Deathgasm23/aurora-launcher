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
    refresh: () => ipcRenderer.invoke('versions:refresh'),
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
    selectFolder: () => ipcRenderer.invoke('settings:select-folder'),
  },
  news: {
    getNews: () => ipcRenderer.invoke('news:get'),
    onNewsUpdated: (callback: (items: any[]) => void) => {
      ipcRenderer.on('news:updated', (_event, items) => callback(items))
    },
    removeNewsUpdatedListener: () => {
      ipcRenderer.removeAllListeners('news:updated')
    },
  },
  logs: {
    getLogs: () => ipcRenderer.invoke('logs:get'),
    clearLogs: () => ipcRenderer.invoke('logs:clear'),
    deleteEntry: (index: number) => ipcRenderer.invoke('logs:delete-entry', index),
    deleteAllFiles: () => ipcRenderer.invoke('logs:delete-all-files'),
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
  servers: {
    list: () => ipcRenderer.invoke('servers:list'),
    save: (servers: any[]) => ipcRenderer.invoke('servers:save', servers),
    ping: (address: string, port: number) => ipcRenderer.invoke('servers:ping', address, port),
  },
  screenshots: {
    list: () => ipcRenderer.invoke('screenshots:list'),
    open: () => ipcRenderer.invoke('screenshots:open'),
    delete: (filePath: string) => ipcRenderer.invoke('screenshots:delete', filePath),
    uploadImgur: (filePath: string) => ipcRenderer.invoke('screenshots:upload-imgur', filePath),
    copyImage: (filePath: string) => ipcRenderer.invoke('screenshots:copy-image', filePath),
  },
  playtime: {
    getStats: () => ipcRenderer.invoke('playtime:stats'),
  },

  crashReports: {
    list: () => ipcRenderer.invoke('crash-reports:list'),
    get: (filePath: string) => ipcRenderer.invoke('crash-reports:get', filePath),
    delete: (filePath: string) => ipcRenderer.invoke('crash-reports:delete', filePath),
    deleteAll: () => ipcRenderer.invoke('crash-reports:delete-all'),
  },
  worlds: {
    list: () => ipcRenderer.invoke('worlds:list'),
    backup: (worldName: string) => ipcRenderer.invoke('worlds:backup', worldName),
    listBackups: () => ipcRenderer.invoke('worlds:list-backups'),
    restore: (backupPath: string) => ipcRenderer.invoke('worlds:restore', backupPath),
    deleteBackup: (backupPath: string) => ipcRenderer.invoke('worlds:delete-backup', backupPath),
  },
  resourcePacks: {
    list: () => ipcRenderer.invoke('resource-packs:list'),
    delete: (packPath: string) => ipcRenderer.invoke('resource-packs:delete', packPath),
    openFolder: () => ipcRenderer.invoke('resource-packs:open-folder'),
  },
  shaderPacks: {
    list: () => ipcRenderer.invoke('shaderpacks:list'),
    delete: (packPath: string) => ipcRenderer.invoke('shaderpacks:delete', packPath),
    openFolder: () => ipcRenderer.invoke('shaderpacks:open-folder'),
  },
  modrinth: {
    search: (query: string, projectType: string, limit?: number, index?: string, versions?: string[], loaders?: string[]) => ipcRenderer.invoke('modrinth:search', query, projectType, limit, index, versions, loaders),
    versions: (projectId: string) => ipcRenderer.invoke('modrinth:versions', projectId),
    install: (projectId: string, destinationDir: string, fileName?: string) => ipcRenderer.invoke('modrinth:install', projectId, destinationDir, fileName),
    projects: (projectIds: string[]) => ipcRenderer.invoke('modrinth:projects', projectIds),
    onDownloadProgress: (callback: (progress: { projectId: string; bytes: number; total: number }) => void) => {
      ipcRenderer.on('modrinth:download-progress', (_event, progress) => callback(progress))
    },
    removeDownloadProgressListener: () => {
      ipcRenderer.removeAllListeners('modrinth:download-progress')
    },
  },
  cleanup: {
    run: () => ipcRenderer.invoke('cleanup:run'),
  },
  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('shell:open-path', filePath),
    openSettingsFolder: () => ipcRenderer.invoke('shell:open-settings-folder'),
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
    readTextFile: () => ipcRenderer.invoke('dialog:read-text-file'),
    writeTextFile: (content: string, defaultName?: string) => ipcRenderer.invoke('dialog:write-text-file', content, defaultName),
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:show-item', filePath),
  },

  onLaunchOutput,
  removeLaunchOutputListener,
  onLaunchError,
  removeLaunchErrorListener,
  onLaunchExit,
  removeLaunchExitListener,
})
