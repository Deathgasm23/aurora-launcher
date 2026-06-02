import { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw, Loader2, X } from 'lucide-react'
import { MinecraftAccount, LauncherSettings, QueuedDownload } from '../shared/types'
import Titlebar from './components/Layout/Titlebar'
import Sidebar from './components/Sidebar/Sidebar'
import Home from './pages/Home'
import Accounts from './pages/Accounts'
import Versions from './pages/Versions'
import Settings from './pages/Settings'
import Logs from './pages/Logs'
import Saves from './pages/Saves'
import ServersPage from './pages/ServersPage'
import CrashReports from './pages/CrashReports'

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
    if (settings?.accentColor) {
      document.documentElement.style.setProperty('--accent', settings.accentColor)
      const hover = lightenColor(settings.accentColor, 20)
      document.documentElement.style.setProperty('--accent-hover', hover)
      document.documentElement.style.setProperty('--accent-dim', settings.accentColor + '1a')
      document.documentElement.style.setProperty('--accent-subtle', settings.accentColor + '0a')
    }
  }, [settings?.accentColor])

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
    window.electronAPI.update.onAvailable((info) => setUpdateInfo({ status: 'available', version: info.version }))
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.metaKey) {
        const pageMap: Record<string, string> = {
          '1': 'home', '2': 'accounts', '3': 'versions',
          '4': 'settings', '5': 'logs', '6': 'saves',
          '7': 'servers',
        }
        if (e.key === '-') { e.preventDefault(); setActivePage('crash-reports'); return }
        const page = pageMap[e.key]
        if (page) {
          e.preventDefault()
          setActivePage(page)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
    await window.electronAPI.launch.setLastVersion(versionId)
    setActivePage('home')
  }, [])

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
      <div className="app-layout">
        <Titlebar />
        <div className="flex items-center justify-center" style={{ flex: 1, paddingTop: 32 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      </div>
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
      case 'saves':
        return <Saves />
      case 'servers':
        return <ServersPage currentAccount={currentAccount} onLaunch={handleLaunch} />
      case 'crash-reports':
        return <CrashReports />
      default:
        return <Home currentAccount={currentAccount} onLaunch={handleLaunch} lastVersion={settings.lastVersion} />
    }
  }

  return (
    <>
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
    <div className="app-layout">
      <Titlebar />
      <Sidebar activePage={activePage} onNavigate={setActivePage} newVersionsCount={newVersionsCount} onNewVersionsRead={() => setNewVersionsCount(0)} />
      {updateInfo && (
        <div className="update-bar">
          {updateInfo.status === 'checking' && (
            <><Loader2 size={14} className="spinner" /> Checking for updates...</>
          )}
          {updateInfo.status === 'available' && (
            <><Download size={14} /> Update <strong>v{updateInfo.version}</strong> available
              <button className="btn btn-primary btn-xs" style={{ marginLeft: 'auto' }} onClick={async () => {
                await window.electronAPI.update.download()
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
          {updateInfo.status === 'uptodate' && (
            <><RefreshCw size={14} /> Already up to date</>
          )}
          {updateInfo.status === 'error' && (
            <><X size={14} /> Update check failed: {updateInfo.error}</>
          )}
        </div>
      )}
      <div className="main-content">
        {renderPage()}
      </div>
      {downloadQueue.length > 0 && (
        <DownloadQueueBar queue={downloadQueue} onRemove={removeFromQueue} />
      )}
    </div>
    </>
  )
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (num >> 16) + percent)
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent)
  const b = Math.min(255, (num & 0x0000FF) + percent)
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
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
