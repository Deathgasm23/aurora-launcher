import { useState, useEffect, useCallback } from 'react'
import { Folder, FolderOpen, Cpu, Monitor, Save, Download, Upload, FileCode, Palette, ExternalLink, Trash2, Zap, Plus, Pencil, X, ChevronDown, ChevronRight } from 'lucide-react'
import type { LauncherSettings, JavaInstallation, LaunchProfile } from '../../shared/types'
import Notification from '../components/common/Notification'
import CollapsibleCard from '../components/common/CollapsibleCard'

export default function Settings() {
  const [settings, setSettings] = useState<LauncherSettings | null>(null)
  const [allCollapsed, setAllCollapsed] = useState<boolean | null>(null)
  const [javaInstallations, setJavaInstallations] = useState<JavaInstallation[]>([])
  const [detectingJava, setDetectingJava] = useState(false)
  const [detectionAttempted, setDetectionAttempted] = useState(false)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<LaunchProfile | null>(null)
  const [profileForm, setProfileForm] = useState<LaunchProfile>({ id: '', name: '', maxMemory: 4096, width: 1280, height: 720, fullscreen: false, javaArgs: '' })

  useEffect(() => {
    window.electronAPI.settings.get().then(setSettings)
    detectJava()
  }, [])

  const detectJava = useCallback(async () => {
    setDetectingJava(true)
    setDetectionAttempted(true)
    try {
      const installations = await window.electronAPI.launch.getJavaInstallations()
      setJavaInstallations(installations)
      const validated = []
      for (const inst of installations) {
        const result = await window.electronAPI.launch.validateJava(inst.path)
        validated.push({ ...inst, valid: result.valid, version: result.version || inst.version })
      }
      setJavaInstallations(validated)
    } catch {}
    setDetectingJava(false)
  }, [])

  function updateSetting(key: keyof LauncherSettings, value: any) {
    if (!settings) return
    const updated = { ...settings, [key]: value, minMemory: 1024 }
    setSettings(updated)
    if (key === 'theme') {
      if (value === 'light') document.documentElement.classList.add('theme-light')
      else document.documentElement.classList.remove('theme-light')
    }
    if (key === 'performanceMode') {
      document.documentElement.classList.toggle('performance-mode', !!value)
    }
  }

  async function saveSettings() {
    if (!settings) return
    if (settings.maxMemory < 1024) {
      setNotif({ message: 'Max RAM must be at least 1024 MB', type: 'error' })
      return
    }
    await window.electronAPI.settings.set(settings)
    setNotif({ message: 'Settings saved', type: 'success' })
  }

  async function handleExport() {
    const result = await window.electronAPI.settings.exportSettings()
    if (result.success) {
      setNotif({ message: 'Settings exported successfully', type: 'success' })
    }
  }

  async function handleImport() {
    const result = await window.electronAPI.settings.importSettings()
    if (result.success && result.settings) {
      setSettings(result.settings)
      setNotif({ message: 'Settings imported successfully', type: 'success' })
    }
  }

  async function handleOpenConfigFolder() {
    await window.electronAPI.shell.openSettingsFolder()
  }

  async function handleBrowseMinecraftDir() {
    const result = await window.electronAPI.settings.selectFolder()
    if (result.success && result.path) {
      updateSetting('minecraftDirectory', result.path)
    }
  }

  function handleSaveProfile() {
    if (!settings || !profileForm.name.trim()) return
    const profiles = settings.launchProfiles || []
    const existing = profiles.findIndex(p => p.id === profileForm.id)
    if (existing >= 0) {
      profiles[existing] = { ...profileForm, id: profileForm.id || Date.now().toString() }
    } else {
      profiles.push({ ...profileForm, id: Date.now().toString() })
    }
    updateSetting('launchProfiles', profiles)
    setShowProfileModal(false)
    setEditingProfile(null)
    setNotif({ message: 'Profile saved', type: 'success' })
  }

  function handleDeleteProfile(id: string) {
    if (!settings) return
    const profiles = (settings.launchProfiles || []).filter(p => p.id !== id)
    updateSetting('launchProfiles', profiles)
    setNotif({ message: 'Profile deleted', type: 'info' })
  }

  function handleEditProfile(profile: LaunchProfile) {
    setEditingProfile(profile)
    setProfileForm({ ...profile })
    setShowProfileModal(true)
  }

  function handleNewProfile() {
    setEditingProfile(null)
    setProfileForm({ id: '', name: '', maxMemory: 4096, width: 1280, height: 720, fullscreen: false, javaArgs: '' })
    setShowProfileModal(true)
  }

  if (!settings) return <div className="page-container"><div className="spinner" /></div>

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}

      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure launcher and game settings</p>
      </div>

      <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
        <button className="btn btn-ghost btn-xs" onClick={() => setAllCollapsed(allCollapsed === null ? false : null)}>
          {allCollapsed === null ? <ChevronRight size={12} /> : <ChevronDown size={12} />} {allCollapsed === null ? 'Expand All' : 'Collapse All'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 }}>

        <CollapsibleCard icon={<Folder size={16} />} title="Minecraft Directory" forceOpen={allCollapsed === false ? true : null}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div className="flex gap-2">
              <input className="input" value={settings.minecraftDirectory}
                onChange={e => updateSetting('minecraftDirectory', e.target.value)}
                placeholder="Path to Minecraft directory" style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={handleBrowseMinecraftDir} title="Browse for folder">
                <FolderOpen size={14} /> Browse
              </button>
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard icon={<Cpu size={16} />} title="Java Settings" forceOpen={allCollapsed === false ? true : null}>
          <div className="form-group">
            <label className="form-label">Java Executable</label>
            <div className="flex gap-2">
              <input className="input" value={settings.javaPath}
                onChange={e => updateSetting('javaPath', e.target.value)}
                placeholder="Path to java executable" style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={detectJava} disabled={detectingJava}>
                {detectingJava ? <span className="spinner" /> : 'Detect'}
              </button>
              {settings.javaPath && (
                <button className="btn btn-ghost" onClick={async () => {
                  const result = await window.electronAPI.launch.validateJava(settings.javaPath)
                  setNotif({ message: result.valid ? `Java OK (v${result.version})` : 'Invalid Java path', type: result.valid ? 'success' : 'error' })
                }}>
                  Test
                </button>
              )}
            </div>
            {detectionAttempted && javaInstallations.length === 0 && !detectingJava && (
              <div style={{ marginTop: 16, padding: 14, background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 8 }}>No Java installation found</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                  Minecraft requires Java to run. Download one of these runtimes:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                    onClick={() => window.electronAPI.shell.openExternal('https://adoptium.net/temurin/releases/?version=21')}>
                    <ExternalLink size={12} /> Download Temurin (Adoptium)
                  </button>
                  <button className="btn btn-sm" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                    onClick={() => window.electronAPI.shell.openExternal('https://www.oracle.com/java/technologies/downloads/')}>
                    <ExternalLink size={12} /> Download Oracle Java
                  </button>
                </div>
              </div>
            )}
            {javaInstallations.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <label className="form-label">Detected Java Installations</label>
                <select className="select" onChange={e => updateSetting('javaPath', e.target.value)} value={settings.javaPath || ''}>
                  <option value="">Select...</option>
                  {javaInstallations.map((j, i) => (
                    <option key={i} value={j.path}>{j.path} {j.version ? `(v${j.version}` : ''}{j.architecture ? `, ${j.architecture})` : j.version ? ')' : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Min RAM</label>
              <div className="text-sm" style={{ color: 'var(--text-secondary)', padding: '6px 0' }}>1024 MB (1 GB) — fixed</div>
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: 280 }}>
              <label className="form-label">Max RAM</label>
              <div className="flex items-center gap-3">
                <input type="range" min={1024} max={16384} step={256} value={settings.maxMemory}
                  onChange={e => updateSetting('maxMemory', parseInt(e.target.value))}
                  className="ram-slider" style={{ flex: 1, '--range-pct': `${((settings.maxMemory - 1024) / (16384 - 1024)) * 100}%` } as React.CSSProperties} />
                <input className="input" type="number" value={settings.maxMemory}
                  onChange={e => updateSetting('maxMemory', Math.max(1024, Math.min(65536, parseInt(e.target.value) || 1024)))}
                  min={1024} max={65536} style={{ width: 100, textAlign: 'center' }} />
                <span className="text-sm text-muted">MB</span>
              </div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                {settings.maxMemory >= 8192 ? 'High (>8 GB) — ensure your system has enough RAM' :
                 settings.maxMemory >= 4096 ? 'Recommended (4-8 GB) for most setups' :
                 'Low (<4 GB) — suitable for older versions'}
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 16, marginBottom: 0 }}>
            <label className="form-label">Java Arguments</label>
            <input className="input" value={settings.javaArgs}
              onChange={e => updateSetting('javaArgs', e.target.value)}
              placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled" />
          </div>
        </CollapsibleCard>

        <CollapsibleCard icon={<Monitor size={16} />} title="Display Settings" forceOpen={allCollapsed === false ? true : null}>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Width</label>
              <input className="input" type="number" value={settings.width}
                onChange={e => updateSetting('width', parseInt(e.target.value) || 854)}
                min={640} max={7680} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Height</label>
              <input className="input" type="number" value={settings.height}
                onChange={e => updateSetting('height', parseInt(e.target.value) || 480)}
                min={480} max={4320} />
            </div>
            <div className="form-group flex items-center gap-3" style={{ justifyContent: 'flex-end', marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Fullscreen</label>
              <label className="toggle">
                <input type="checkbox" checked={settings.fullscreen}
                  onChange={e => updateSetting('fullscreen', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
          <div>
            <label className="form-label" style={{ marginBottom: 6 }}>Quick Presets</label>
            <div className="resolution-presets" style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-xs btn-secondary" onClick={() => setSettings(prev => prev ? { ...prev, width: 1280, height: 720 } : prev)}>720p</button>
              <button className="btn btn-xs btn-secondary" onClick={() => setSettings(prev => prev ? { ...prev, width: 1920, height: 1080 } : prev)}>1080p</button>
              <button className="btn btn-xs btn-secondary" onClick={() => setSettings(prev => prev ? { ...prev, width: 2560, height: 1440 } : prev)}>1440p</button>
              <button className="btn btn-xs btn-secondary" onClick={() => setSettings(prev => prev ? { ...prev, width: screen.width, height: screen.height } : prev)}>Native</button>
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard icon={<Palette size={16} />} title="Appearance" forceOpen={allCollapsed === false ? true : null}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Theme</label>
            <div className="flex items-center gap-3">
              <button
                className={`btn ${settings.theme === 'dark' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => updateSetting('theme', 'dark')}
              >
                Dark
              </button>
              <button
                className={`btn ${settings.theme === 'light' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => updateSetting('theme', 'light')}
              >
                Light
              </button>
              <span className="text-sm text-muted">
                {settings.theme === 'dark' ? 'Dark mode (default)' : 'Light mode'}
              </span>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Performance Mode</label>
            <div className="flex items-center gap-3">
              <label className="toggle">
                <input type="checkbox" checked={settings.performanceMode || false}
                  onChange={e => updateSetting('performanceMode', e.target.checked)} />
                <span className={`toggle-slider ${settings.performanceMode ? 'active' : ''}`} />
              </label>
              <span className="text-sm text-muted">Disable steam vents, gear overlays, and animations</span>
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard icon={<Zap size={16} />} title="Launch Profiles" forceOpen={allCollapsed === false ? true : null}>
          <p className="text-sm text-muted" style={{ marginBottom: 12 }}>Save and quickly apply configuration bundles from the Home page.</p>
          {(settings.launchProfiles || []).length === 0 ? (
            <div className="text-sm text-muted" style={{ marginBottom: 12 }}>No profiles yet.</div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {(settings.launchProfiles || []).map(p => (
                <div key={p.id} className="profile-card">
                  <div className="profile-card-info">
                    <div className="profile-card-name">{p.name}</div>
                    <div className="profile-card-details">{p.maxMemory}MB · {p.width}×{p.height}{p.fullscreen ? ' · Fullscreen' : ''}{p.javaArgs ? ` · ${p.javaArgs}` : ''}</div>
                  </div>
                  <button className="btn btn-ghost btn-xs" onClick={() => handleEditProfile(p)} title="Edit"><Pencil size={12} /></button>
                  <button className="btn btn-ghost btn-xs" onClick={() => handleDeleteProfile(p.id)} title="Delete" style={{ color: 'var(--error)' }}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleNewProfile}><Plus size={14} /> New Profile</button>
        </CollapsibleCard>

        <CollapsibleCard icon={<FileCode size={16} />} title="Additional Launch Arguments" forceOpen={allCollapsed === false ? true : null}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input className="input" value={settings.launchArgs}
              onChange={e => updateSetting('launchArgs', e.target.value)} placeholder="--extra-args" />
          </div>
        </CollapsibleCard>

        <CollapsibleCard icon={<Trash2 size={16} />} title="Auto Cleanup" forceOpen={allCollapsed === false ? true : null}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '0 0 160px' }}>
              <label className="form-label">Delete older than (days)</label>
              <input className="input" type="number" value={settings.autoCleanupDays ?? 30}
                onChange={e => updateSetting('autoCleanupDays', Math.max(1, parseInt(e.target.value) || 30))}
                min={1} max={365} />
            </div>
            <div className="form-group" style={{ flex: '0 0 auto' }}>
              <label className="form-label">Options</label>
              <div className="flex items-center gap-3">
                <label className="toggle">
                  <input type="checkbox" checked={settings.autoCleanupLogs || false}
                    onChange={e => updateSetting('autoCleanupLogs', e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span className="text-sm text-muted">Clean logs too</span>
              </div>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">&nbsp;</label>
              <button className="btn btn-secondary btn-sm" onClick={async () => {
                const result = await window.electronAPI.cleanup.run()
                if (result.success) {
                  setNotif({ message: `Cleaned up ${result.deleted} old file(s)`, type: 'success' })
                } else {
                  setNotif({ message: 'Cleanup failed', type: 'error' })
                }
              }}>
                <Trash2 size={14} /> Clean Now
              </button>
            </div>
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 10 }}>
            Crash reports{settings.autoCleanupLogs ? ' and logs' : ''} older than {settings.autoCleanupDays ?? 30} days will be deleted automatically.
          </div>
        </CollapsibleCard>

        <CollapsibleCard icon={<Upload size={16} />} title="Integrations" forceOpen={allCollapsed === false ? true : null}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Imgur Client-ID</label>
            <input className="input" value={settings.imgurClientId || ''}
              onChange={e => updateSetting('imgurClientId', e.target.value)}
              placeholder="Register at https://api.imgur.com/oauth2/addclient" />
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>
              Required for uploading screenshots to Imgur. Get your own free Client-ID at api.imgur.com.
            </div>
          </div>
        </CollapsibleCard>

        {/* === ACTION BUTTONS === */}
        <div className="card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={saveSettings}><Save size={16} /> Save Settings</button>
          <button className="btn btn-secondary" onClick={handleExport} title="Export settings to file"><Download size={14} /> Export</button>
          <button className="btn btn-secondary" onClick={handleImport} title="Import settings from file"><Upload size={14} /> Import</button>
          <button className="btn btn-ghost" onClick={handleOpenConfigFolder} title="Open config folder"><FileCode size={14} /></button>
          <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>Changes are saved locally</span>
        </div>
      </div>

      {showProfileModal && (
        <div className="modal-overlay" style={{ zIndex: 5000 }} onClick={() => setShowProfileModal(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editingProfile ? 'Edit Profile' : 'New Profile'}</h2>
            <div className="form-group">
              <label className="form-label">Profile Name</label>
              <input className="input" value={profileForm.name} onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 1080p Max RAM" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Max RAM (MB)</label>
              <input className="input" type="number" value={profileForm.maxMemory} onChange={e => setProfileForm(f => ({ ...f, maxMemory: Math.max(1024, parseInt(e.target.value) || 4096) }))} min={1024} max={65536} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Width</label>
                <input className="input" type="number" value={profileForm.width} onChange={e => setProfileForm(f => ({ ...f, width: parseInt(e.target.value) || 854 }))} min={640} max={7680} />
              </div>
              <div className="form-group">
                <label className="form-label">Height</label>
                <input className="input" type="number" value={profileForm.height} onChange={e => setProfileForm(f => ({ ...f, height: parseInt(e.target.value) || 480 }))} min={480} max={4320} />
              </div>
            </div>
            <div className="form-group flex items-center gap-3">
              <label className="form-label" style={{ marginBottom: 0 }}>Fullscreen</label>
              <label className="toggle">
                <input type="checkbox" checked={profileForm.fullscreen} onChange={e => setProfileForm(f => ({ ...f, fullscreen: e.target.checked }))} />
                <span className={`toggle-slider ${profileForm.fullscreen ? 'active' : ''}`} />
              </label>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Java Args</label>
              <input className="input" value={profileForm.javaArgs} onChange={e => setProfileForm(f => ({ ...f, javaArgs: e.target.value }))} placeholder="-XX:+UseG1GC..." />
            </div>
            <div className="flex items-center gap-2" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowProfileModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={!profileForm.name.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
