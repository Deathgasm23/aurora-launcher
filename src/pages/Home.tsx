import { useState, useEffect, useCallback } from 'react'
import { Check, Loader2, Zap, RefreshCw, Cpu, FolderOpen, Download, Save, Clock } from 'lucide-react'
import type { MinecraftAccount, MinecraftVersion, InstallProgress, LaunchProfile } from '../../shared/types'
import Notification from '../components/common/Notification'
import { playChime } from '../utils/sound'

interface HomeProps {
  currentAccount: MinecraftAccount | null
  onLaunch: (accountId: string, versionId: string, javaPath?: string) => Promise<{ success: boolean; error?: string }>
  lastVersion?: string
}

export default function Home({ currentAccount, onLaunch, lastVersion }: HomeProps) {
  const [loading, setLoading] = useState(true)
  const [manifest, setManifest] = useState<{ versions: MinecraftVersion[]; latest: { release: string; snapshot: string } } | null>(null)
  const [selectedVersion, setSelectedVersion] = useState('')
  const [launching, setLaunching] = useState(false)
  const [gameRunning, setGameRunning] = useState(false)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null)
  const [javaOverride, setJavaOverride] = useState('')
  const [profiles, setProfiles] = useState<LaunchProfile[]>([])
  const [playtimeStats, setPlaytimeStats] = useState<any>(null)

  const loadPlaytime = useCallback(async () => {
    try {
      const stats = await window.electronAPI.playtime.getStats()
      setPlaytimeStats(stats)
    } catch {}
  }, [])

  const loadManifest = useCallback(async () => {
    try {
      const m = await window.electronAPI.versions.getManifest()
      setManifest(m)
      if (m.versions.length > 0) {
        const preferred = lastVersion
          ? m.versions.find((v: MinecraftVersion) => v.id === lastVersion && v.installed)
          : null
        if (preferred) {
          setSelectedVersion(preferred.id)
        } else {
          const latestInstalled = m.versions.find(
            (v: MinecraftVersion) => v.installed && v.type === 'release'
          )
          setSelectedVersion(latestInstalled?.id || m.latest.release)
        }
      }
    } catch {
      setNotif({ message: 'Failed to load version manifest', type: 'error' })
    }
    setLoading(false)
  }, [lastVersion])

  useEffect(() => {
    loadManifest()
    loadPlaytime()
    window.electronAPI.settings.get().then(s => setProfiles(s.launchProfiles || []))

    const onProgress = (progress: InstallProgress) => {
      setInstallProgress(progress)
      if (progress.status === 'done' || progress.status === 'error') {
        loadManifest()
        if (progress.status === 'done') {
          setTimeout(() => setInstallProgress(null), 2000)
          setNotif({ message: progress.message, type: 'success' })
          playChime()
        }
      }
    }

    const onExit = (code: number) => {
      setLaunching(false)
      setGameRunning(false)
      setNotif({ message: `Game exited with code ${code}`, type: code === 0 ? 'info' : 'error' })
    }

    window.electronAPI.versions.onInstallProgress(onProgress)
    window.electronAPI.onLaunchExit(onExit)

    return () => {
      window.electronAPI.versions.removeInstallProgressListener()
      window.electronAPI.removeLaunchExitListener()
    }
  }, [loadManifest])

  const handleLaunch = useCallback(async () => {
    if (!currentAccount || !selectedVersion) {
      setNotif({ message: 'Select an account and version first', type: 'error' })
      return
    }
    setLaunching(true)
    setGameRunning(false)
    await window.electronAPI.launch.setLastVersion(selectedVersion)
    const result = await onLaunch(currentAccount.id, selectedVersion, javaOverride || undefined)
    setLaunching(false)
    if (!result.success) {
      setNotif({ message: result.error || 'Failed to launch game', type: 'error' })
    } else {
      setGameRunning(true)
    }
  }, [currentAccount, selectedVersion, onLaunch, javaOverride])

  const availableVersions = manifest?.versions.filter(v => v.installed) || []
  const selectedVersionData = manifest?.versions.find(v => v.id === selectedVersion)
  const latestRelease = manifest?.versions.find(v => v.id === manifest.latest.release)
  const latestInstalled = latestRelease?.installed

  function handleOpenGameFolder() {
    window.electronAPI.settings.get().then(s => window.electronAPI.shell.openPath(s.minecraftDirectory))
  }

  async function handleInstallLatest() {
    if (!latestRelease) return
    const result = await window.electronAPI.versions.installVersion(latestRelease.id)
    if (!result.success) {
      setNotif({ message: result.error || 'Installation failed', type: 'error' })
    }
  }

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}

      <div className="page-header">
        <h1 className="page-title">Home</h1>
        <p className="page-subtitle">Launch Minecraft and manage your game.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}>
          <div className="spinner" />
        </div>
      ) : (<>
        <div className="launch-panel" style={{ maxWidth: 400, width: '100%' }}>
          <div className="launch-avatar">
            <div className="launch-avatar-placeholder">
              {currentAccount?.username?.charAt(0).toUpperCase() || '?'}
            </div>
          </div>
          <div className="launch-username">
            {currentAccount?.username || 'No Account Selected'}
          </div>
          {currentAccount && (
            <div className="text-xs text-muted" style={{ marginTop: -12 }}>
              Offline Account
            </div>
          )}

          <div className="w-full" style={{ maxWidth: 320 }}>
            <div className="flex items-center gap-2">
              <select
                className="select"
                value={selectedVersion}
                onChange={e => setSelectedVersion(e.target.value)}
                disabled={launching || gameRunning}
                style={{ flex: 1 }}
              >
                <option value="">Select version...</option>
                {availableVersions.map(v => (
                  <option key={v.id} value={v.id}>{v.id}</option>
                ))}
              </select>
              <button
                className="btn btn-ghost btn-sm"
                onClick={loadManifest}
                title="Refresh versions"
                style={{ flexShrink: 0 }}
              >
                <RefreshCw size={14} />
              </button>
            </div>
            {selectedVersionData && (
              <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                {selectedVersionData.type !== 'custom' && (
                  <span className={`badge ${selectedVersionData.type === 'release' ? 'badge-release' : 'badge-snapshot'}`}>
                    {selectedVersionData.type}
                  </span>
                )}
                {selectedVersionData.releaseTime && (
                  <span className="text-xs text-muted">
                    {new Date(selectedVersionData.releaseTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
                {playtimeStats?.byVersion?.[selectedVersion] && (
                  <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                    <Clock size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    {Math.round(playtimeStats.byVersion[selectedVersion].totalDuration / 60)}m played
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="w-full" style={{ maxWidth: 320 }}>
            <div className="flex items-center gap-2">
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  className="input"
                  placeholder="Java path (optional override)"
                  value={javaOverride}
                  onChange={e => setJavaOverride(e.target.value)}
                  disabled={launching || gameRunning}
                  style={{ paddingLeft: 32 }}
                />
                <Cpu size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              </div>
            </div>
          </div>

          {profiles.length > 0 && (
            <div className="w-full" style={{ maxWidth: 320 }}>
              <div className="flex items-center gap-2">
                <select className="select" style={{ flex: 1 }}
                  defaultValue=""
                  onChange={async e => {
                    const p = profiles.find(pr => pr.id === e.target.value)
                    if (!p) return
                    const s = await window.electronAPI.settings.get()
                    await window.electronAPI.settings.set({ ...s, maxMemory: p.maxMemory, width: p.width, height: p.height, fullscreen: p.fullscreen, javaArgs: p.javaArgs })
                    setNotif({ message: `Applied profile: ${p.name}`, type: 'success' })
                  }}>
                  <option value="" disabled>Apply profile...</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Save size={14} style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}

          <div className="w-full" style={{ maxWidth: 320, display: 'flex', gap: 8 }}>
            {!latestInstalled && latestRelease && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleInstallLatest}
                style={{ flex: 1 }}
                title={`Install latest release (${latestRelease.id})`}
              >
                <Download size={14} /> Install {latestRelease.id}
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleOpenGameFolder}
              title="Open game folder"
            >
              <FolderOpen size={14} />
            </button>
          </div>

          <button
            className="btn btn-primary launch-btn"
            onClick={handleLaunch}
            disabled={!currentAccount || !selectedVersion || launching || gameRunning}
          >
            {launching ? (
              <><Loader2 size={18} className="spinner" /> Launching...</>
            ) : gameRunning ? (
              <><Check size={18} /> Launched</>
            ) : (
              <><Zap size={18} /> Launch Game</>
            )}
          </button>

          {installProgress && (
            <div className="w-full" style={{ maxWidth: 320 }}>
              <div className="flex items-center gap-3 mb-2">
                <Loader2 size={14} className="spinner" />
                <span className="text-sm text-muted">{installProgress.message}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${installProgress.progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </>
      )}
    </div>
  )
}
