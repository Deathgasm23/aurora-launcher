import { useState, useEffect } from 'react'
import { Save, Upload, Download, Trash2, Clock, FolderOpen, RotateCcw } from 'lucide-react'
import type { SaveEntry, BackupEntry } from '../../shared/types'
import Notification from '../components/common/Notification'

function Saves() {
  const [saves, setSaves] = useState<SaveEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [selectedSave, setSelectedSave] = useState<string | null>(null)
  const [backups, setBackups] = useState<BackupEntry[]>([])

  async function loadSaves() {
    try {
      const list = await window.electronAPI.saves.list()
      setSaves(list)
    } catch {
      setNotif({ message: 'Failed to load saves', type: 'error' })
    }
    setLoading(false)
  }

  useEffect(() => { loadSaves() }, [])

  async function handleBackup(saveName: string) {
    const result = await window.electronAPI.saves.backup(saveName)
    if (result.success) {
      setNotif({ message: `Backup created for "${saveName}"`, type: 'success' })
      if (selectedSave === saveName) loadBackups(saveName)
    } else {
      setNotif({ message: result.error || 'Backup failed', type: 'error' })
    }
  }

  async function loadBackups(saveName: string) {
    setSelectedSave(saveName)
    const list = await window.electronAPI.saves.listBackups(saveName)
    setBackups(list)
  }

  async function handleRestore(backupName: string, saveName: string) {
    const result = await window.electronAPI.saves.restore(backupName, saveName)
    if (result.success) {
      setNotif({ message: `Restored "${saveName}" from backup`, type: 'success' })
      loadSaves()
      loadBackups(saveName)
    } else {
      setNotif({ message: result.error || 'Restore failed', type: 'error' })
    }
  }

  async function handleDeleteBackup(backupPath: string) {
    const result = await window.electronAPI.saves.deleteBackup(backupPath)
    if (result.success) {
      setNotif({ message: 'Backup deleted', type: 'info' })
      if (selectedSave) loadBackups(selectedSave)
    }
  }

  async function handleOpenSavesFolder() {
    const settings = await window.electronAPI.settings.get()
    await window.electronAPI.shell.openPath(settings.minecraftDirectory + '/saves')
  }

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}
      <div className="page-header">
        <h1 className="page-title">Saves</h1>
        <p className="page-subtitle">Backup and restore your worlds</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}><div className="spinner" /></div>
      ) : (
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted">{saves.length} world(s)</span>
            <button className="btn btn-ghost btn-sm" onClick={handleOpenSavesFolder}><FolderOpen size={14} /> Open folder</button>
          </div>
          {saves.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              No worlds found. Play Minecraft to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {saves.map(s => (
                <div key={s.name} className={`version-card ${selectedSave === s.name ? 'active' : ''}`}
                  onClick={() => loadBackups(s.name)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="version-info">
                    <div className="version-name">{s.name}</div>
                    <div className="version-date">
                      <Clock size={11} />
                      {new Date(s.lastPlayed).toLocaleDateString()} · {s.size}
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); handleBackup(s.name) }} title="Backup">
                    <Upload size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedSave && (
          <div className="card" style={{ width: 280, flexShrink: 0 }}>
            <h3 className="section-title">Backups: {selectedSave}</h3>
            {backups.length === 0 ? (
              <div className="text-sm text-muted">No backups yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {backups.map(b => {
                  const saveName = selectedSave
                  return (
                    <div key={b.name} className="flex items-center gap-2" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{new Date(b.date).toLocaleString()}</div>
                        <div className="text-muted">{b.size}</div>
                      </div>
                      <button className="btn btn-ghost btn-xs" onClick={() => handleRestore(b.name, saveName)} title="Restore">
                        <RotateCcw size={11} />
                      </button>
                      <button className="btn btn-ghost btn-xs" onClick={() => handleDeleteBackup(b.path)} title="Delete backup"
                        style={{ color: 'var(--error)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

export default Saves
