import { useState, useEffect, useCallback } from 'react'
import { Folder, FolderOpen, Cpu, Monitor, Save, Download, Upload, FileCode, Palette, ExternalLink } from 'lucide-react'
import type { LauncherSettings, JavaInstallation } from '../../shared/types'
import Notification from '../components/common/Notification'

export default function Settings() {
  const [settings, setSettings] = useState<LauncherSettings | null>(null)
  const [javaInstallations, setJavaInstallations] = useState<JavaInstallation[]>([])
  const [detectingJava, setDetectingJava] = useState(false)
  const [detectionAttempted, setDetectionAttempted] = useState(false)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

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

  if (!settings) return <div className="page-container"><div className="spinner" /></div>

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}

      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure launcher and game settings</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
        <div className="card">
          <h2 className="section-title flex items-center gap-2"><Folder size={16} /> Minecraft Directory</h2>
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
        </div>

        <div className="card">
          <h2 className="section-title flex items-center gap-2"><Cpu size={16} /> Java Settings</h2>
          <div className="form-group">
            <label className="form-label">Java Executable</label>
            <div className="flex gap-2">
              <input className="input" value={settings.javaPath}
                onChange={e => updateSetting('javaPath', e.target.value)}
                placeholder="Path to java executable" style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={detectJava} disabled={detectingJava}>
                {detectingJava ? <span className="spinner" /> : 'Detect'}
              </button>
            </div>
            {detectionAttempted && javaInstallations.length === 0 && !detectingJava && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 'var(--radius-sm)', background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)' }}>
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
                    <option key={i} value={j.path}>{j.path} {j.version ? `(${j.version})` : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="settings-section">
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Min RAM</label>
              <div className="text-sm" style={{ color: 'var(--text-secondary)', padding: '6px 0' }}>1024 MB (1 GB) — fixed</div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Max RAM</label>
              <div className="flex items-center gap-3">
                <input type="range" min={1024} max={16384} step={256} value={settings.maxMemory}
                  onChange={e => updateSetting('maxMemory', parseInt(e.target.value))}
                  className="ram-slider" style={{ flex: 1 }} />
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

          <div className="settings-section">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Java Arguments</label>
              <input className="input" value={settings.javaArgs}
                onChange={e => updateSetting('javaArgs', e.target.value)}
                placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title flex items-center gap-2"><Monitor size={16} /> Display Settings</h2>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Width</label>
              <input className="input" type="number" value={settings.width}
                onChange={e => updateSetting('width', parseInt(e.target.value) || 854)}
                min={640} max={7680} />
            </div>
            <div className="form-group">
              <label className="form-label">Height</label>
              <input className="input" type="number" value={settings.height}
                onChange={e => updateSetting('height', parseInt(e.target.value) || 480)}
                min={480} max={4320} />
            </div>
          </div>
          <div className="form-group flex items-center gap-3" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Fullscreen</label>
            <label className="toggle">
              <input type="checkbox" checked={settings.fullscreen}
                onChange={e => updateSetting('fullscreen', e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title flex items-center gap-2"><Palette size={16} /> Appearance</h2>
          <div className="form-group flex items-center gap-3" style={{ marginBottom: 0 }}>
            <div>
              <label className="form-label">Accent Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.accentColor || '#d97706'}
                  onChange={e => updateSetting('accentColor', e.target.value)}
                  style={{ width: 36, height: 36, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', padding: 2 }} />
                <input className="input" value={settings.accentColor || ''}
                  onChange={e => updateSetting('accentColor', e.target.value)} placeholder="#d97706"
                  style={{ width: 160, fontSize: 12 }} />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="section-title">Additional Launch Arguments</h2>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input className="input" value={settings.launchArgs}
              onChange={e => updateSetting('launchArgs', e.target.value)} placeholder="--extra-args" />
          </div>
        </div>

        <div className="flex items-center gap-3" style={{ paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={saveSettings}><Save size={16} /> Save Settings</button>
          <button className="btn btn-secondary" onClick={handleExport} title="Export settings to file"><Download size={14} /> Export</button>
          <button className="btn btn-secondary" onClick={handleImport} title="Import settings from file"><Upload size={14} /> Import</button>
          <button className="btn btn-ghost" onClick={handleOpenConfigFolder} title="Open config folder"><FileCode size={14} /></button>
          <span className="text-xs text-muted">Changes are saved locally</span>
        </div>
      </div>
    </div>
  )
}
