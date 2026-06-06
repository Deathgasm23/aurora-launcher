import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { MinecraftAccount, LauncherSettings, QueuedDownload } from '../shared/types'
import Titlebar from './components/Layout/Titlebar'
import Navbar from './components/Sidebar/Sidebar'
import Home from './pages/Home'
import CommandPalette from './components/CommandPalette'
import { playChime } from './utils/sound'

const Accounts = lazy(() => import('./pages/Accounts'))
const Versions = lazy(() => import('./pages/Versions'))
const Settings = lazy(() => import('./pages/Settings'))
const Logs = lazy(() => import('./pages/Logs'))
const ServersPage = lazy(() => import('./pages/ServersPage'))
const Screenshots = lazy(() => import('./pages/Screenshots'))
const CrashReports = lazy(() => import('./pages/CrashReports'))
const NewsPage = lazy(() => import('./pages/NewsPage'))
const WorldsPage = lazy(() => import('./pages/WorldsPage'))
const ResourcePacksPage = lazy(() => import('./pages/ResourcePacksPage'))
const ShaderpacksPage = lazy(() => import('./pages/ShaderpacksPage'))

export default function App() {
  const [activePage, setActivePage] = useState('home')
  const [currentAccount, setCurrentAccount] = useState<MinecraftAccount | null>(null)
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([])
  const [settings, setSettings] = useState<LauncherSettings | null>(null)
  const [newVersionsCount, setNewVersionsCount] = useState(0)
  const [firstLaunch, setFirstLaunch] = useState(false)
  const [firstLaunchUsername, setFirstLaunchUsername] = useState('')
  const [firstLaunchLoading, setFirstLaunchLoading] = useState(false)
  const [downloadQueue, setDownloadQueue] = useState<QueuedDownload[]>([])
  const [updateInfo, setUpdateInfo] = useState<{ status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'uptodate' | 'error'; version?: string; progress?: number; error?: string } | null>(null)

  const refreshState = useCallback(async () => {
    try {
      const [acc, allAccs, settingsData] = await Promise.all([
        window.electronAPI.auth.getCurrentAccount(),
        window.electronAPI.auth.getAccounts(),
        window.electronAPI.settings.get(),
      ])
      setCurrentAccount(acc)
      setAccounts(allAccs)
      setSettings(settingsData)
    } catch {}
  }, [])

  useEffect(() => {
    refreshState()
    const interval = setInterval(refreshState, 5000)
    return () => clearInterval(interval)
  }, [refreshState])

  useEffect(() => {
    if (settings && accounts.length === 0 && !firstLaunch) {
      setFirstLaunch(true)
    }
  }, [settings, accounts])

  useEffect(() => {
    if (settings?.theme === 'light') {
      document.documentElement.classList.add('theme-light')
    } else {
      document.documentElement.classList.remove('theme-light')
    }
  }, [settings?.theme])

  async function handleFirstLaunchCreate() {
    if (!firstLaunchUsername.trim()) return
    setFirstLaunchLoading(true)
    const result = await window.electronAPI.auth.loginOffline(firstLaunchUsername.trim())
    setFirstLaunchLoading(false)
    if (result.success) {
      setFirstLaunch(false)
      setFirstLaunchUsername('')
      refreshState()
    }
  }

  useEffect(() => {
    window.electronAPI.versions.onNewVersions((versions: string[]) => {
      setNewVersionsCount(prev => prev + versions.length)
    })
    return () => {
      window.electronAPI.versions.removeNewVersionsListener()
    }
  }, [])

  useEffect(() => {
    window.electronAPI.update.check()
    window.electronAPI.update.onChecking(() => setUpdateInfo({ status: 'checking' }))
    window.electronAPI.update.onAvailable((info) => { setUpdateInfo({ status: 'available', version: info.version }); playChime() })
    window.electronAPI.update.onNotAvailable(() => {
      setUpdateInfo({ status: 'uptodate' })
      setTimeout(() => setUpdateInfo(null), 3000)
    })
    window.electronAPI.update.onDownloadProgress((progress) =>
      setUpdateInfo(prev => prev ? { ...prev, status: 'downloading', progress: Math.round(progress.percent) } : null)
    )
    window.electronAPI.update.onDownloaded((info) =>
      setUpdateInfo({ status: 'downloaded', version: info.version })
    )
    window.electronAPI.update.onError((message) => {
      setUpdateInfo({ status: 'error', error: message })
      setTimeout(() => setUpdateInfo(null), 5000)
    })
    return () => {
      window.electronAPI.update.removeCheckingListener?.()
      window.electronAPI.update.removeAvailableListener?.()
      window.electronAPI.update.removeNotAvailableListener?.()
    }
  }, [])

  useEffect(() => {
    if (settings?.performanceMode) {
      document.documentElement.classList.add('performance-mode')
    } else {
      document.documentElement.classList.remove('performance-mode')
    }
  }, [settings?.performanceMode])

  // keyboard shortcuts removed to prevent interference with typing

  const handleLaunch = useCallback(async (accountId: string, versionId: string, javaPath?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (javaPath) {
        return await window.electronAPI.launch.launchGameWithJava(accountId, versionId, javaPath)
      }
      return await window.electronAPI.launch.launchGame(accountId, versionId)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const handleVersionsLaunch = useCallback(async (accountId: string, versionId: string) => {
    const result = await handleLaunch(accountId, versionId)
    if (result.success) {
      window.electronAPI.launch.setLastVersion(versionId)
    }
    return result
  }, [handleLaunch])

  function addToQueue(versionId: string) {
    setDownloadQueue(prev => {
      if (prev.find(d => d.versionId === versionId)) return prev
      return [...prev, { versionId, status: 'queued', progress: 0, message: 'Queued' }]
    })
  }

  const removeFromQueue = (versionId: string) => {
    setDownloadQueue(prev => prev.filter(d => d.versionId !== versionId))
  }

  const updateQueueItem = (versionId: string, update: Partial<QueuedDownload>) => {
    setDownloadQueue(prev => prev.map(d => d.versionId === versionId ? { ...d, ...update } : d))
  }

  if (!settings) {
    return (
      <>
        <Titlebar />
        <div className="load-screen">
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      </>
    )
  }

  const renderPage = () => {
    switch (activePage) {
      case 'home':
        return <Home currentAccount={currentAccount} onLaunch={handleLaunch} lastVersion={settings.lastVersion} />
      case 'accounts':
        return <Accounts onAccountsChanged={refreshState} />
      case 'versions':
        return <Versions currentAccount={currentAccount} onLaunch={handleVersionsLaunch} />
      case 'settings':
        return <Settings />
      case 'logs':
        return <Logs />
      case 'servers':
        return <ServersPage currentAccount={currentAccount} />
      case 'screenshots':
        return <Screenshots />
      case 'news':
        return <NewsPage />
      case 'worlds':
        return <WorldsPage />
      case 'resource-packs':
        return <ResourcePacksPage />
      case 'shaderpacks':
        return <ShaderpacksPage />
      case 'crash-reports':
        return <CrashReports />
      default:
        return <Home currentAccount={currentAccount} onLaunch={handleLaunch} lastVersion={settings.lastVersion} />
    }
  }

  return (
    <>
    <CommandPalette onNavigate={setActivePage} />
    {firstLaunch && (
      <div className="modal-overlay" style={{ zIndex: 5000 }}>
        <div className="modal" style={{ textAlign: 'center', maxWidth: 380 }} onClick={e => e.stopPropagation()}>
          <h2 className="modal-title">Welcome to Aurora</h2>
          <p className="text-sm text-muted" style={{ marginBottom: 20, lineHeight: 1.6 }}>
            Create an offline account to get started. You can add more accounts later.
          </p>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              className="input"
              placeholder="Enter username (max 16 chars)"
              value={firstLaunchUsername}
              onChange={e => setFirstLaunchUsername(e.target.value.slice(0, 16))}
              onKeyDown={e => e.key === 'Enter' && !firstLaunchLoading && firstLaunchUsername.trim() && handleFirstLaunchCreate()}
              autoFocus
              disabled={firstLaunchLoading}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Letters, numbers, and underscores only
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleFirstLaunchCreate}
            disabled={!firstLaunchUsername.trim() || firstLaunchLoading}
          >
            {firstLaunchLoading ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </div>
    )}
    <Titlebar />
    <Navbar activePage={activePage} onNavigate={setActivePage} newVersionsCount={newVersionsCount} onNewVersionsRead={() => setNewVersionsCount(0)} accounts={accounts} currentAccount={currentAccount} onSwitchAccount={async (accountId) => { await window.electronAPI.auth.setCurrentAccount(accountId); refreshState() }} />
    {!firstLaunch && updateInfo && updateInfo.status !== 'checking' && updateInfo.status !== 'uptodate' && (
      <div className="update-bar">
        {updateInfo.status === 'available' && (
          <><Download size={14} /> Update <strong>v{updateInfo.version}</strong> available
            <button className="btn btn-primary btn-xs" style={{ marginLeft: 'auto' }} onClick={() => {
              window.electronAPI.shell.openExternal('https://github.com/Deathgasm23/aurora-launcher/releases')
            }}>Download</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setUpdateInfo(null)}><X size={12} /></button>
          </>
        )}
        {updateInfo.status === 'downloading' && (
          <><Loader2 size={14} className="spinner" /> Downloading update... {updateInfo.progress}%
            <div className="progress-bar" style={{ flex: 1, maxWidth: 160, marginLeft: 8 }}>
              <div className="progress-fill" style={{ width: `${updateInfo.progress}%` }} />
            </div>
          </>
        )}
        {updateInfo.status === 'downloaded' && (
          <><Download size={14} /> Update <strong>v{updateInfo.version}</strong> downloaded
            <button className="btn btn-primary btn-xs" style={{ marginLeft: 'auto' }} onClick={() => window.electronAPI.update.install()}>Restart & Install</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setUpdateInfo(null)}><X size={12} /></button>
          </>
        )}
        {updateInfo.status === 'error' && (
          <><X size={14} /> Update check: {updateInfo.error}</>
        )}
      </div>
    )}
    <div className="main-content">
      <Suspense fallback={<div className="flex items-center justify-center" style={{ flex: 1, padding: 48 }}><div className="spinner" /></div>}>
        {renderPage()}
      </Suspense>
      <div className="page-footer">
        <button className="btn btn-ghost btn-sm" onClick={() => window.electronAPI.shell.openExternal('https://github.com/Deathgasm23/aurora-launcher')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>
          GitHub
        </button>
        <span className="text-xs text-muted">Aurora Launcher — open source Minecraft launcher</span>
      </div>
    </div>
    {downloadQueue.length > 0 && (
      <DownloadQueueBar queue={downloadQueue} onRemove={removeFromQueue} />
    )}
    </>
  )
}

function DownloadQueueBar({ queue, onRemove }: { queue: QueuedDownload[]; onRemove: (id: string) => void }) {
  return (
    <div className="download-queue-bar">
      <span className="download-queue-label">
        Queue ({queue.length})
      </span>
      <div className="download-queue-items">
        {queue.map(d => (
          <div key={d.versionId} className="download-queue-item">
            <span>{d.versionId}</span>
            {d.status === 'installing' && <span className="spinner" style={{ width: 12, height: 12 }} />}
            {d.status === 'done' && <span style={{ color: 'var(--success)' }}>Done</span>}
            {d.status === 'error' && <span style={{ color: 'var(--error)' }}>Error</span>}
            <button className="btn btn-ghost btn-xs" onClick={() => onRemove(d.versionId)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
