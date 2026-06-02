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
        launchGame: (accountId: string, versionId: string) => Promise<{ success: boolean; error?: string }>
        launchGameWithJava: (accountId: string, versionId: string, javaPath?: string) => Promise<{ success: boolean; error?: string }>
        getJavaInstallations: () => Promise<any[]>
        validateJava: (javaPath: string) => Promise<{ valid: boolean; version?: string }>
        setLastVersion: (versionId: string) => Promise<void>
      }
      settings: {
        get: () => Promise<any>
        set: (settings: any) => Promise<void>
        getDefault: () => Promise<any>
      }
      news: {
        getNews: () => Promise<any[]>
      }
      logs: {
        getLogs: () => Promise<any[]>
        clearLogs: () => Promise<void>
      }
      client: {
        getStatus: () => Promise<{
          launcherVersion: string
          installedVersions: number
          currentAccount: string | null
          javaInstallations: number
          totalVersions: number
        }>
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
