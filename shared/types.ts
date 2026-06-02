export interface MinecraftAccount {
  id: string
  username: string
  uuid?: string
  accessToken?: string
  refreshToken?: string
  skinUrl?: string
  type: 'microsoft' | 'offline'
  lastUsed: number
}

export type MinecraftVersion = {
  id: string
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha'
  url: string
  time: string
  releaseTime: string
  installed: boolean
  installProgress?: number
}

export interface VersionManifest {
  latest: {
    release: string
    snapshot: string
  }
  versions: MinecraftVersion[]
}

export type VersionJson = {
  id: string
  type: string
  mainClass: string
  minecraftArguments?: string
  arguments?: {
    game?: (string | ArgRule)[]
    jvm?: (string | ArgRule)[]
  }
  assets: string
  assetIndex: AssetIndex
  downloads: Downloads
  libraries: Library[]
  logging?: Logging
  complianceLevel?: number
  inheritsFrom?: string
  javaVersion?: {
    component: string
    majorVersion: number
  }
}

export interface ArgRule {
  rules: Rule[]
  value: string | string[]
}

export type Rule = {
  action: 'allow' | 'disallow'
  os?: {
    name?: string
    arch?: string
    version?: string
  }
  features?: Record<string, any>
}

export interface AssetIndex {
  id: string
  sha1: string
  size: number
  totalSize: number
  url: string
}

export type Downloads = {
  client: DownloadEntry
  client_mappings?: DownloadEntry
  server?: DownloadEntry
  server_mappings?: DownloadEntry
}

export interface DownloadEntry {
  sha1: string
  size: number
  url: string
  path?: string
}

export type Library = {
  downloads: {
    artifact?: DownloadEntry
    classifiers?: Record<string, DownloadEntry>
  }
  name: string
  rules?: Rule[]
  natives?: Record<string, string>
  extract?: {
    exclude: string[]
  }
}

export interface Logging {
  client: {
    argument: string
    file: DownloadEntry
    type: string
  }
}

export type JavaInstallation = {
  path: string
  version: string
  architecture: string
}

export interface LauncherSettings {
  minecraftDirectory: string
  javaPath: string
  minMemory: number
  maxMemory: number
  javaArgs: string
  width: number
  height: number
  fullscreen: boolean
  theme: 'dark' | 'light'
  accentColor: string
  launchArgs: string
  lastVersion?: string
}

export type LaunchOptions = {
  account: MinecraftAccount
  version: MinecraftVersion
  settings: LauncherSettings
  versionJson: VersionJson
  extras?: {
    serverAddress?: string
    serverPort?: number
    worldName?: string
  }
}

export interface InstallProgress {
  versionId: string
  status: 'downloading' | 'extracting' | 'verifying' | 'done' | 'error'
  progress: number
  message: string
}

export type LogEntry = {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  source: string
}

export interface NewsItem {
  title: string
  link: string
  description: string
  pubDate: string
}

export type SaveEntry = {
  name: string
  path: string
  lastPlayed: number
  size: string
  icon?: string
}

export type BackupEntry = {
  name: string
  path: string
  date: number
  size: string
}

export interface ServerEntry {
  id: string
  name: string
  address: string
  port: number
  version?: string
  icon?: string
}

export interface ServerStatus {
  online: boolean
  motd?: string
  players?: { online: number; max: number }
  version?: string
  protocol?: number
  latency: number
  icon?: string
}

export type QueuedDownload = {
  versionId: string
  status: 'queued' | 'installing' | 'done' | 'error'
  progress: number
  message: string
}

export interface CrashReport {
  title: string
  path: string
  time: number
  content: string
}

export type ScreenshotEntry = {
  name: string
  path: string
  time: number
  size: number
}

export type ClientStatus = {
  launcherVersion: string
  installedVersions: number
  currentAccount: string | null
  javaInstallations: number
  updateAvailable: boolean
  updateVersion: string
  totalVersions: number
}
