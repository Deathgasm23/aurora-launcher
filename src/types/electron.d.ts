export {}

declare global {
  interface Window {
    electronAPI: {
      auth: {
        loginOffline: (username: string) => Promise<{ success: boolean; account?: any; error?: string }>
        logout: (accountId: string) => Promise<void>
        getAccounts: () => Promise<any[]>
        setCurrentAccount: (accountId: string) => Promise<void>
        getCurrentAccount: () => Promise<any>
      }
      versions: {
        getManifest: () => Promise<any>
        refresh: () => Promise<any>
        getVersionJson: (versionId: string) => Promise<any>
        installVersion: (versionId: string) => Promise<{ success: boolean; error?: string }>
        deleteVersion: (versionId: string) => Promise<{ success: boolean; error?: string }>
        reinstallVersion: (versionId: string) => Promise<{ success: boolean; error?: string }>
        getInstalledVersions: () => Promise<string[]>
        onInstallProgress: (callback: (progress: any) => void) => void
        removeInstallProgressListener: () => void
        onNewVersions: (callback: (versions: string[]) => void) => void
        removeNewVersionsListener: () => void
      }
      launch: {
        launchGame: (accountId: string, versionId: string, javaPath?: string) => Promise<{ success: boolean; error?: string }>
        launchGameWithJava: (accountId: string, versionId: string, javaPath?: string) => Promise<{ success: boolean; error?: string }>
        launchGameWithExtras: (accountId: string, versionId: string, extras: any) => Promise<{ success: boolean; error?: string }>
        getJavaInstallations: () => Promise<any[]>
        validateJava: (javaPath: string) => Promise<{ valid: boolean; version?: string }>
        setLastVersion: (versionId: string) => Promise<void>
      }
      settings: {
        get: () => Promise<any>
        set: (settings: any) => Promise<void>
        getDefault: () => Promise<any>
        getPath: () => Promise<string>
        exportSettings: () => Promise<{ success: boolean; error?: string }>
        importSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>
        selectFolder: () => Promise<{ success: boolean; path?: string }>
      }
      news: {
        getNews: () => Promise<any[]>
        onNewsUpdated: (callback: (items: any[]) => void) => void
        removeNewsUpdatedListener: () => void
      }
      logs: {
        getLogs: () => Promise<any[]>
        clearLogs: () => Promise<void>
        deleteEntry: (index: number) => Promise<void>
        deleteAllFiles: () => Promise<void>
      }
      client: {
        getStatus: () => Promise<any>
      }
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
      }
      app: {
        getVersion: () => Promise<string>
        checkForUpdates: () => Promise<{ updateAvailable: boolean; version?: string }>
      }
      update: {
        check: () => Promise<{ success: boolean; error?: string }>
        download: () => Promise<{ success: boolean; error?: string }>
        install: () => Promise<{ success: boolean; error?: string }>
        onChecking: (callback: () => void) => void
        onAvailable: (callback: (info: any) => void) => void
        onNotAvailable: (callback: (info: any) => void) => void
        onDownloadProgress: (callback: (progress: any) => void) => void
        onDownloaded: (callback: (info: any) => void) => void
        onError: (callback: (message: string) => void) => void
        removeCheckingListener?: () => void
        removeAvailableListener?: () => void
        removeNotAvailableListener?: () => void
      }
      servers: {
        list: () => Promise<any[]>
        save: (servers: any[]) => Promise<void>
        ping: (address: string, port: number) => Promise<any>
      }
      screenshots: {
        list: () => Promise<any[]>
        open: () => Promise<void>
        delete: (filePath: string) => Promise<{ success: boolean; error?: string }>
        uploadImgur: (filePath: string) => Promise<{ success: boolean; url?: string; error?: string }>
        copyImage: (filePath: string) => Promise<{ success: boolean; error?: string }>
      }
      playtime: {
        getStats: () => Promise<any>
      }
      crashReports: {
        list: () => Promise<any[]>
        get: (filePath: string) => Promise<any>
        delete: (filePath: string) => Promise<void>
        deleteAll: () => Promise<void>
      }
      worlds: {
        list: () => Promise<any[]>
        backup: (worldName: string) => Promise<{ success: boolean; path?: string; size?: number; error?: string }>
        listBackups: () => Promise<any[]>
        restore: (backupPath: string) => Promise<{ success: boolean; error?: string }>
        deleteBackup: (backupPath: string) => Promise<{ success: boolean; error?: string }>
      }
      resourcePacks: {
        list: () => Promise<any[]>
        delete: (packPath: string) => Promise<{ success: boolean; error?: string }>
        openFolder: () => Promise<{ success: boolean; error?: string }>
      }
      shaderPacks: {
        list: () => Promise<any[]>
        delete: (packPath: string) => Promise<{ success: boolean; error?: string }>
        openFolder: () => Promise<{ success: boolean; error?: string }>
      }
      modrinth: {
        search: (query: string, projectType: string, limit?: number, index?: string, versions?: string[], loaders?: string[]) => Promise<{ success: boolean; hits?: any[]; total?: number; error?: string }>
        versions: (projectId: string) => Promise<{ success: boolean; versions?: any[]; error?: string }>
        install: (projectId: string, destinationDir: string, fileName?: string) => Promise<{ success: boolean; path?: string; fileName?: string; error?: string }>
        projects: (projectIds: string[]) => Promise<{ success: boolean; projects?: any[]; error?: string }>
        onDownloadProgress: (callback: (progress: { projectId: string; bytes: number; total: number }) => void) => void
        removeDownloadProgressListener: () => void
      }
      cleanup: {
        run: () => Promise<{ success: boolean; deleted: number }>
      }
      shell: {
        openPath: (filePath: string) => Promise<void>
        openExternal: (url: string) => Promise<void>
        openSettingsFolder: () => Promise<void>
        readTextFile: () => Promise<string | null>
        writeTextFile: (content: string, defaultName?: string) => Promise<{ success: boolean; error?: string }>
        showItemInFolder: (filePath: string) => Promise<void>
      }
      onLaunchOutput: (callback: (data: string) => void) => void
      removeLaunchOutputListener: () => void
      onLaunchError: (callback: (data: string) => void) => void
      removeLaunchErrorListener: () => void
      onLaunchExit: (callback: (code: number) => void) => void
      removeLaunchExitListener: () => void
    }
  }
}
