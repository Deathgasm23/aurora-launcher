import { useState, useEffect } from 'react'
import { Globe, Download, Upload, Trash2, RefreshCw, Archive, FileArchive, Clock, HardDrive } from 'lucide-react'
import Notification from '../components/common/Notification'
import ConfirmDialog from '../components/common/ConfirmDialog'

export default function WorldsPage() {
  const [worlds, setWorlds] = useState<any[]>([])
  const [backups, setBackups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [backingUp, setBackingUp] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showBackups, setShowBackups] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [w, b] = await Promise.all([
        window.electronAPI.worlds.list(),
        window.electronAPI.worlds.listBackups(),
      ])
      setWorlds(w)
      setBackups(b)
    } catch {}
    setLoading(false)
  }

  async function handleBackup(worldName: string) {
    setBackingUp(worldName)
    const result = await window.electronAPI.worlds.backup(worldName)
    setBackingUp(null)
    if (result.success) {
      setNotif({ message: `Backup created: ${worldName}`, type: 'success' })
      const b = await window.electronAPI.worlds.listBackups()
      setBackups(b)
    } else {
      setNotif({ message: result.error || 'Backup failed', type: 'error' })
    }
  }

  async function handleRestore(backupPath: string) {
    setRestoring(backupPath)
    const result = await window.electronAPI.worlds.restore(backupPath)
    setRestoring(null)
    if (result.success) {
      setNotif({ message: 'World restored successfully', type: 'success' })
      loadAll()
    } else {
      setNotif({ message: result.error || 'Restore failed', type: 'error' })
    }
  }

  async function handleDeleteBackup(backupPath: string) {
    const result = await window.electronAPI.worlds.deleteBackup(backupPath)
    if (result.success) {
      setNotif({ message: 'Backup deleted', type: 'success' })
      const b = await window.electronAPI.worlds.listBackups()
      setBackups(b)
    }
    setConfirmDelete(null)
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}
      <div className="page-header">
        <h1 className="page-title">Worlds & Saves</h1>
        <p className="page-subtitle">Backup and restore your Minecraft worlds</p>
      </div>

      <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
        <span className="text-sm text-muted">{worlds.length} world(s)</span>
        <button className="btn btn-ghost btn-sm" onClick={loadAll}><RefreshCw size={14} /></button>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowBackups(!showBackups)}>
            <Archive size={14} /> {showBackups ? 'Show Worlds' : `Show Backups (${backups.length})`}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}><div className="spinner" /></div>
      ) : !showBackups ? (
        worlds.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Globe size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div>No worlds found. Play Minecraft to create a world, then back it up here.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {worlds.map((world, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                <Globe size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{world.name}</div>
                  <div className="flex items-center gap-3" style={{ marginTop: 2 }}>
                    <span className="text-xs text-muted flex items-center gap-1"><HardDrive size={10} /> {formatSize(world.size)}</span>
                    <span className="text-xs text-muted flex items-center gap-1"><Clock size={10} /> {new Date(world.lastPlayed).toLocaleDateString()}</span>
                    {world.hasLevelDat ? (
                      <span className="text-xs" style={{ color: 'var(--success)' }}>Valid</span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--warning)' }}>No level.dat</span>
                    )}
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => handleBackup(world.name)} disabled={backingUp === world.name}>
                  {backingUp === world.name ? <RefreshCw size={12} className="spinner" /> : <Download size={12} />} Backup
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        backups.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileArchive size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div>No backups yet. Go to Worlds tab to create a backup.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {backups.map((backup, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                <FileArchive size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{backup.name}</div>
                  <div className="flex items-center gap-3" style={{ marginTop: 2 }}>
                    <span className="text-xs text-muted flex items-center gap-1"><HardDrive size={10} /> {formatSize(backup.size)}</span>
                    <span className="text-xs text-muted flex items-center gap-1"><Clock size={10} /> {new Date(backup.time).toLocaleDateString()}</span>
                    <span className="text-xs text-muted">{backup.worldName}</span>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => handleRestore(backup.path)} disabled={restoring === backup.path}>
                  {restoring === backup.path ? <RefreshCw size={12} className="spinner" /> : <Upload size={12} />} Restore
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDelete(backup.path)} style={{ color: 'var(--error)' }} title="Delete backup">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Backup"
        message="Are you sure you want to delete this backup file?"
        onConfirm={() => confirmDelete && handleDeleteBackup(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}