import { useState, useEffect, useCallback } from 'react'
import { Download, RefreshCw, Package, Loader2, Trash2, RotateCcw, Search, Play, FolderOpen, Info, PlayIcon, ChevronDown, ChevronRight, MemoryStick, Star, FileText, Save, X, Eye } from 'lucide-react'
import type { MinecraftVersion, MinecraftAccount, InstallProgress, VersionJson, LauncherSettings } from '../../shared/types'
import Notification from '../components/common/Notification'
import EmptyState from '../components/common/EmptyState'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Modal from '../components/common/Modal'
import ContextMenu from '../components/common/ContextMenu'
import { playChime } from '../utils/sound'

interface VersionsProps {
  currentAccount: MinecraftAccount | null
  onLaunch: (accountId: string, versionId: string) => void
}

function getMajorGroup(id: string): string {
  const parts = id.split('.')
  if (parts.length >= 3) return `${parts[0]}.${parts[1]}.x`
  if (parts.length === 2) return `${parts[0]}.${parts[1]}.x`
  return id
}

function Versions({ currentAccount, onLaunch }: VersionsProps) {
  const [versions, setVersions] = useState<MinecraftVersion[]>([])
  const [filter, setFilter] = useState<'all' | 'release' | 'snapshot' | 'custom'>('all')
  const [showInstalledOnly, setShowInstalledOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [installing, setInstalling] = useState<string | null>(null)
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'reinstall'; id: string } | null>(null)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [newVersions, setNewVersions] = useState<string[]>([])
  const [detailsVersion, setDetailsVersion] = useState<{ id: string; json: VersionJson } | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; versionId: string; installed: boolean } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [memSettings, setMemSettings] = useState<LauncherSettings | null>(null)
  const [memVersionId, setMemVersionId] = useState<string | null>(null)
  const [memValue, setMemValue] = useState(4096)
  const [pinnedVersions, setPinnedVersions] = useState<string[]>([])
  const [instanceNotes, setInstanceNotes] = useState<Record<string, string>>({})
  const [noteVersionId, setNoteVersionId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [batchMode, setBatchMode] = useState(false)
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(new Set())
  const [batchInstalling, setBatchInstalling] = useState(false)
  const loadVersions = useCallback(async () => {
    try {
      const manifest = await window.electronAPI.versions.getManifest()
      setVersions(manifest.versions || [])
    } catch {
      setNotif({ message: 'Failed to fetch version manifest', type: 'error' })
    }
    setPageLoading(false)
  }, [])

  useEffect(() => {
    loadVersions()

    window.electronAPI.settings.get().then(s => {
      setPinnedVersions(s.pinnedVersions || [])
      setInstanceNotes(s.instanceNotes || {})
    })

    window.electronAPI.versions.onInstallProgress((progress: InstallProgress) => {
      setInstallProgress(progress)
      if (progress.status === 'done') {
        setInstalling(null)
        loadVersions()
        setTimeout(() => setInstallProgress(null), 2000)
        setNotif({ message: progress.message, type: 'success' })
        playChime()
      }
      if (progress.status === 'error') {
        setInstalling(null)
        setNotif({ message: progress.message, type: 'error' })
      }
    })

    window.electronAPI.versions.onNewVersions((versions: string[]) => {
      setNewVersions(prev => [...new Set([...prev, ...versions])])
      setNotif({ message: `${versions.length} new version(s) available!`, type: 'info' })
    })

    return () => {
      window.electronAPI.versions.removeInstallProgressListener()
      window.electronAPI.versions.removeNewVersionsListener()
    }
  }, [loadVersions])

  async function handleInstall(versionId: string) {
    setInstalling(versionId)
    const result = await window.electronAPI.versions.installVersion(versionId)
    if (!result.success) {
      setInstalling(null)
      setNotif({ message: result.error || 'Installation failed', type: 'error' })
    }
  }

  async function handleReinstall(versionId: string) {
    setConfirmAction(null)
    setInstalling(versionId)
    const result = await window.electronAPI.versions.reinstallVersion(versionId)
    if (result.success) {
      setNotif({ message: `${versionId} reinstalled`, type: 'success' })
    } else {
      setNotif({ message: result.error || 'Reinstall failed', type: 'error' })
    }
    setInstalling(null)
    loadVersions()
  }

  async function handleDelete(versionId: string) {
    setConfirmAction(null)
    const result = await window.electronAPI.versions.deleteVersion(versionId)
    if (result.success) {
      setNotif({ message: `${versionId} deleted`, type: 'success' })
      loadVersions()
    } else {
      setNotif({ message: result.error || 'Delete failed', type: 'error' })
    }
  }

  async function handleOpenGameFolder() {
    const settings = await window.electronAPI.settings.get()
    await window.electronAPI.shell.openPath(settings.minecraftDirectory)
  }

  function handleContextMenu(e: React.MouseEvent, versionId: string, installed: boolean) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, versionId, installed })
  }

  async function handleShowDetails(versionId: string) {
    setDetailsLoading(true)
    try {
      const json = await window.electronAPI.versions.getVersionJson(versionId)
      setDetailsVersion({ id: versionId, json })
    } catch {
      setNotif({ message: 'Failed to load version details', type: 'error' })
    }
    setDetailsLoading(false)
  }

  async function handlePlay(versionId: string) {
    if (!currentAccount) {
      setNotif({ message: 'Select an account first', type: 'error' })
      return
    }
    await window.electronAPI.launch.setLastVersion(versionId)
    onLaunch(currentAccount.id, versionId)
  }

  async function togglePin(versionId: string) {
    const settings = await window.electronAPI.settings.get()
    const current = settings.pinnedVersions || []
    const next = current.includes(versionId)
      ? current.filter((v: string) => v !== versionId)
      : [...current, versionId]
    setPinnedVersions(next)
    await window.electronAPI.settings.set({ ...settings, pinnedVersions: next })
  }

  function openNoteModal(versionId: string, note: string) {
    setNoteVersionId(versionId)
    setNoteText(note)
  }

  async function saveNote() {
    if (!noteVersionId) return
    const settings = await window.electronAPI.settings.get()
    const notes = { ...(settings.instanceNotes || {}), [noteVersionId]: noteText }
    setInstanceNotes(notes)
    await window.electronAPI.settings.set({ ...settings, instanceNotes: notes })
    setNoteVersionId(null)
    setNoteText('')
    setNotif({ message: 'Note saved', type: 'success' })
  }

  async function openMemoryModal(versionId: string) {
    const settings = await window.electronAPI.settings.get()
    setMemSettings(settings)
    setMemVersionId(versionId)
    setMemValue(settings.versionMemory?.[versionId]?.maxMemory || settings.maxMemory || 4096)
  }

  async function saveMemorySetting() {
    if (!memSettings || !memVersionId) return
    const updated = {
      ...memSettings,
      versionMemory: {
        ...memSettings.versionMemory,
        [memVersionId]: { maxMemory: memValue },
      },
    }
    await window.electronAPI.settings.set(updated)
    setMemSettings(null)
    setMemVersionId(null)
    setNotif({ message: `RAM saved for ${memVersionId}`, type: 'success' })
  }

  async function clearMemorySetting() {
    if (!memSettings || !memVersionId) return
    const vm = { ...memSettings.versionMemory }
    delete vm[memVersionId]
    const updated = { ...memSettings, versionMemory: vm }
    await window.electronAPI.settings.set(updated)
    setMemSettings(null)
    setMemVersionId(null)
    setNotif({ message: `RAM reset to global default for ${memVersionId}`, type: 'info' })
  }

  function toggleBatchSelect(versionId: string) {
    setSelectedVersions(prev => {
      const next = new Set(prev)
      if (next.has(versionId)) next.delete(versionId)
      else next.add(versionId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedVersions.size === filteredVersions.length) {
      setSelectedVersions(new Set())
    } else {
      setSelectedVersions(new Set(filteredVersions.map(v => v.id)))
    }
  }

  async function handleBatchInstall() {
    setBatchInstalling(true)
    for (const id of selectedVersions) {
      if (versions.find(v => v.id === id)?.installed) continue
      await window.electronAPI.versions.installVersion(id)
    }
    setBatchInstalling(false)
    setSelectedVersions(new Set())
    setBatchMode(false)
    loadVersions()
    setNotif({ message: 'Batch install complete', type: 'success' })
  }

  async function handleBatchDelete() {
    for (const id of selectedVersions) {
      await window.electronAPI.versions.deleteVersion(id)
    }
    setSelectedVersions(new Set())
    setBatchMode(false)
    loadVersions()
    setNotif({ message: 'Batch delete complete', type: 'success' })
  }

  const filteredVersions = versions.filter(v => {
    if (filter === 'release') return v.type === 'release'
    if (filter === 'snapshot') return v.type === 'snapshot'
    if (filter === 'custom') return v.type === 'custom'
    return true
  }).filter(v => !showInstalledOnly || v.installed)
    .filter(v => !search || v.id.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aPinned = pinnedVersions.includes(a.id)
      const bPinned = pinnedVersions.includes(b.id)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return 0
    })

  const grouped = filteredVersions.reduce<Record<string, MinecraftVersion[]>>((acc, v) => {
    const group = v.type === 'custom' ? 'Custom'
      : v.type === 'snapshot' || v.type === 'old_beta' || v.type === 'old_alpha'
        ? 'Snapshots & Old'
        : getMajorGroup(v.id)
    if (!acc[group]) acc[group] = []
    acc[group].push(v)
    return acc
  }, {})

  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'Custom') return 1
    if (b === 'Custom') return -1
    if (a === 'Snapshots & Old') return 1
    if (b === 'Snapshots & Old') return -1
    const aParts = a.replace('.x', '').split('.').map(Number)
    const bParts = b.replace('.x', '').split('.').map(Number)
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const diff = (bParts[i] || 0) - (aParts[i] || 0)
      if (diff !== 0) return diff
    }
    return 0
  })

  function toggleGroup(group: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  function renderVersionCard(version: MinecraftVersion) {
    const badgeClass = version.type === 'release' ? 'badge-release' :
      version.type === 'snapshot' ? 'badge-snapshot' :
      version.type === 'custom' ? 'badge-custom' : 'badge-old'
    const isPinned = pinnedVersions.includes(version.id)
    const note = instanceNotes[version.id]
    return (
      <div key={version.id} className={`version-card ${isPinned ? 'pinned' : ''}`} onContextMenu={e => handleContextMenu(e, version.id, !!version.installed)}>
        <div className="version-info">
          <div className="version-name">
            {batchMode && (
              <input type="checkbox" className="version-checkbox"
                checked={selectedVersions.has(version.id)}
                onChange={() => toggleBatchSelect(version.id)} />
            )}
            {isPinned && <Star size={12} fill="var(--accent)" color="var(--accent)" style={{ marginRight: 6 }} />}
            {version.id}
          </div>
          <div className="version-date">
            {version.type !== 'custom' && <span className={`badge ${badgeClass}`}>{version.type}</span>}
            {version.releaseTime && <span style={{ marginLeft: version.type !== 'custom' ? 8 : 0 }}>{new Date(version.releaseTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => handleShowDetails(version.id)}
              title="Version details"
              style={{ marginLeft: 4 }}
            >
              <Info size={11} />
            </button>
          </div>
          {note && <div className="version-note-preview">{note}</div>}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => togglePin(version.id)}
            title={isPinned ? 'Unpin' : 'Pin to top'}
            style={{ color: isPinned ? 'var(--accent)' : undefined }}
          >
            <Star size={12} fill={isPinned ? 'var(--accent)' : 'none'} />
          </button>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => openNoteModal(version.id, note || '')}
            title="Instance notes"
          >
            <FileText size={12} />
          </button>
          {version.installed ? (
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handlePlay(version.id)}
              disabled={!currentAccount}
              title={currentAccount ? 'Launch' : 'Select an account first'}
            >
              <Play size={14} fill="currentColor" />
            </button>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => openMemoryModal(version.id)}
              title="Memory settings"
            >
              <MemoryStick size={12} />
            </button>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => window.electronAPI.shell.openExternal('https://optifine.net/downloads')}
              title="OptiFine downloads"
            >
              <Eye size={12} />
            </button>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setConfirmAction({ type: 'reinstall', id: version.id })}
              disabled={installing === version.id}
              title="Reinstall"
            >
              <RotateCcw size={12} />
            </button>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setConfirmAction({ type: 'delete', id: version.id })}
              disabled={installing === version.id}
              title="Delete"
              style={{ color: 'var(--error)' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleInstall(version.id)}
            disabled={installing === version.id}
          >
            {installing === version.id ? (
              <Loader2 size={14} className="spinner" />
            ) : (
              <Download size={14} />
            )}
            Install
          </button>
        )}
      </div>
    </div>
    )
  }

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}

      <div className="page-header">
        <h1 className="page-title">Versions</h1>
        <p className="page-subtitle">Install and manage Minecraft versions</p>
      </div>

      {pageLoading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}>
          <div className="spinner" />
        </div>
      ) : (
      <>
      <div className="flex items-center justify-between mb-4" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="filter-bar">
          <button
            className={`filter-btn ${filter === 'release' ? 'active' : ''}`}
            onClick={() => setFilter('release')}
          >
            Release
          </button>
          <button
            className={`filter-btn ${filter === 'snapshot' ? 'active' : ''}`}
            onClick={() => setFilter('snapshot')}
          >
            Snapshots
          </button>
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'custom' ? 'active' : ''}`}
            onClick={() => setFilter('custom')}
          >
            Custom
          </button>
          <button
            className={`filter-btn ${showInstalledOnly ? 'active' : ''}`}
            onClick={() => setShowInstalledOnly(v => !v)}
            style={{ color: showInstalledOnly ? 'var(--success)' : undefined }}
          >
            Installed
          </button>
        </div>
        {batchMode ? (
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ fontWeight: 600, color: 'var(--accent)' }}>{selectedVersions.size} selected</span>
            <button className="btn btn-ghost btn-xs" onClick={toggleSelectAll}>
              {selectedVersions.size === filteredVersions.length ? 'Deselect All' : 'Select All'}
            </button>
            <button className="btn btn-primary btn-xs" onClick={handleBatchInstall} disabled={selectedVersions.size === 0 || batchInstalling}>
              {batchInstalling ? <Loader2 size={12} className="spinner" /> : null} Install Selected
            </button>
            <button className="btn btn-xs" onClick={handleBatchDelete} disabled={selectedVersions.size === 0} style={{ color: 'var(--error)', borderColor: 'var(--error-dim)', border: '1px solid var(--error-dim)', background: 'transparent', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
              <Trash2 size={12} /> Delete Selected
            </button>
            <button className="btn btn-ghost btn-xs" onClick={() => { setBatchMode(false); setSelectedVersions(new Set()) }}>
              <X size={12} /> Exit
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2" style={{ flex: '0 1 auto', minWidth: 0 }}>
            <div style={{ position: 'relative', flex: '0 1 160px', minWidth: 0 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                className="input"
                placeholder="Search versions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 30, paddingTop: 6, paddingBottom: 6, width: '100%' }}
              />
            </div>
            <button className="btn btn-sm btn-ghost" style={{ flexShrink: 0 }} onClick={() => { setBatchMode(true); setSelectedVersions(new Set()) }}>
              Batch
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={async () => { await window.electronAPI.versions.refresh(); loadVersions(); setNewVersions([]) }}>
              <RefreshCw size={14} />
              Refresh
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={handleOpenGameFolder} title="Open game folder">
              <FolderOpen size={14} />
            </button>
          </div>
        )}
      </div>

      {newVersions.length > 0 && !batchMode && (
        <div className="card" style={{ marginBottom: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: '3px solid var(--accent)' }}>
          <span className="text-sm" style={{ flex: 1 }}>
            {newVersions.length} new version(s) available: {newVersions.join(', ')}
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => { loadVersions(); setNewVersions([]) }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      )}

      {installProgress && (
        <div className="card mb-4">
          <div className="flex items-center gap-3">
            <Loader2 size={16} className="spinner" />
            <span className="text-sm" style={{ flex: 1 }}>{installProgress.message}</span>
            <span className="text-xs text-muted">{installProgress.progress}%</span>
          </div>
          <div className="progress-bar mt-2">
            <div className="progress-fill" style={{ width: `${installProgress.progress}%` }} />
          </div>
        </div>
      )}

      {filteredVersions.length === 0 ? (
        <EmptyState
          icon={<Package size={28} />}
          text={search ? 'No versions match your search.' : 'No versions found. Try refreshing the manifest.'}
        >
          {!search && <button className="btn btn-secondary" onClick={loadVersions}><RefreshCw size={14} /> Refresh</button>}
        </EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groupKeys.map(group => {
            const versions = grouped[group]
            const installedCount = versions.filter(v => v.installed).length
            const collapsed = !expandedGroups.has(group)
            return (
              <div key={group} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  className="version-group-header"
                  onClick={() => toggleGroup(group)}
                >
                  <span className="flex items-center gap-2">
                    {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    <span className="version-group-title">{group}</span>
                    <span className="version-group-count">{installedCount}/{versions.length}</span>
                  </span>
                </button>
                {!collapsed && (
                  <div style={{ padding: '6px 8px 8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {versions.map(renderVersionCard)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmAction?.type === 'delete'}
        title="Delete Version"
        message="This will permanently delete the version files. You can reinstall it later."
        confirmLabel="Delete"
        onConfirm={() => confirmAction && handleDelete(confirmAction.id)}
        onCancel={() => setConfirmAction(null)}
        danger
      />
      <ConfirmDialog
        open={confirmAction?.type === 'reinstall'}
        title="Reinstall Version"
        message="This will delete and re-download the entire version. Your saves and settings will not be affected."
        confirmLabel="Reinstall"
        onConfirm={() => confirmAction && handleReinstall(confirmAction.id)}
        onCancel={() => setConfirmAction(null)}
      />

      <ContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={() => setContextMenu(null)}
        items={[
          { label: 'Play', icon: <PlayIcon size={14} />, onClick: () => contextMenu && handlePlay(contextMenu.versionId), disabled: !contextMenu?.installed || !currentAccount },
          { label: contextMenu?.installed ? 'Reinstall' : 'Install', icon: <Download size={14} />, onClick: () => contextMenu && (contextMenu.installed ? setConfirmAction({ type: 'reinstall', id: contextMenu.versionId }) : handleInstall(contextMenu.versionId)) },
          { label: 'Memory', icon: <MemoryStick size={14} />, onClick: () => contextMenu && openMemoryModal(contextMenu.versionId) },
          { label: 'OptiFine', icon: <Eye size={14} />, onClick: () => contextMenu && window.electronAPI.shell.openExternal('https://optifine.net/downloads') },
          { label: 'Details', icon: <Info size={14} />, onClick: () => contextMenu && handleShowDetails(contextMenu.versionId) },
          { label: pinnedVersions.includes(contextMenu?.versionId || '') ? 'Unpin' : 'Pin to Top', icon: <Star size={14} />, onClick: () => contextMenu && togglePin(contextMenu.versionId) },
          { label: 'Notes', icon: <FileText size={14} />, onClick: () => contextMenu && openNoteModal(contextMenu.versionId, instanceNotes[contextMenu.versionId] || '') },
          { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => contextMenu && setConfirmAction({ type: 'delete', id: contextMenu.versionId }), danger: true, disabled: !contextMenu?.installed },
        ]}
      />

      <Modal
        open={memVersionId !== null}
        onClose={() => { setMemVersionId(null); setMemSettings(null) }}
        title={memVersionId ? `Memory: ${memVersionId}` : ''}
        actions={
          <div className="flex items-center gap-2" style={{ width: '100%', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={clearMemorySetting}>Use Global</button>
            <button className="btn btn-secondary" onClick={() => { setMemVersionId(null); setMemSettings(null) }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveMemorySetting}>Save</button>
          </div>
        }>
        <div className="form-group" style={{ marginBottom: 8 }}>
          <div className="form-label">Max RAM (per-version override)</div>
          <div className="flex items-center gap-3">
            <input type="range" min={1024} max={16384} step={256} value={memValue}
              onChange={e => setMemValue(parseInt(e.target.value))}
              className="ram-slider" style={{ flex: 1 }} />
            <input className="input" type="number" value={memValue}
              onChange={e => setMemValue(Math.max(1024, Math.min(65536, parseInt(e.target.value) || 1024)))}
              min={1024} max={65536} style={{ width: 100, textAlign: 'center' }} />
            <span className="text-sm text-muted">MB</span>
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 6 }}>
            Overrides the global max RAM for this version. Leave empty or click "Use Global" to fall back to Settings.
          </div>
        </div>
      </Modal>

      <Modal
        open={detailsVersion !== null}
        onClose={() => setDetailsVersion(null)}
        title={detailsVersion ? `Version: ${detailsVersion.id}` : ''}
      >
        {detailsLoading ? (
          <div className="flex items-center justify-center" style={{ padding: 32 }}>
            <div className="spinner" />
          </div>
        ) : detailsVersion && (
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <div>
                <div className="form-label">Type</div>
                <span className="text-sm">{detailsVersion.json.type || 'unknown'}</span>
              </div>
              <div>
                <div className="form-label">Release Date</div>
                <span className="text-sm">{detailsVersion.json.releaseTime ? new Date(detailsVersion.json.releaseTime).toLocaleDateString() : 'unknown'}</span>
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <div>
                <div className="form-label">Java Version</div>
                <span className="text-sm">{detailsVersion.json.javaVersion?.majorVersion || 'any'}</span>
              </div>
              <div>
                <div className="form-label">Minecraft Version</div>
                <span className="text-sm">{detailsVersion.json.id || 'unknown'}</span>
              </div>
            </div>
            {detailsVersion.json.libraries && (
              <div>
                <div className="form-label">Libraries</div>
                <span className="text-sm">{detailsVersion.json.libraries.length} total</span>
              </div>
            )}
            {detailsVersion.json.mainClass && (
              <div style={{ marginTop: 4 }}>
                <div className="form-label">Main Class</div>
                <span className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{detailsVersion.json.mainClass}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={noteVersionId !== null}
        onClose={() => { setNoteVersionId(null); setNoteText('') }}
        title={noteVersionId ? `Notes: ${noteVersionId}` : ''}
        actions={
          <div className="flex items-center gap-2" style={{ width: '100%', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setNoteVersionId(null); setNoteText('') }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveNote}><Save size={14} /> Save</button>
          </div>
        }>
        <textarea
          className="textarea"
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          placeholder="Add personal notes about this version (e.g. requires Java 17, laggy with shaders)..."
          rows={6}
          style={{ width: '100%', resize: 'vertical' }}
        />
      </Modal>

      </>
      )}
    </div>
  )
}

export default Versions
