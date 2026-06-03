import { useState, useEffect } from 'react'
import { Image, FolderOpen, Trash2, ExternalLink } from 'lucide-react'
import type { ScreenshotEntry } from '../../shared/types'
import Notification from '../components/common/Notification'
import EmptyState from '../components/common/EmptyState'

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Screenshots() {
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  async function loadScreenshots() {
    try {
      const list = await window.electronAPI.screenshots.list()
      setScreenshots(list)
    } catch {
      setNotif({ message: 'Failed to load screenshots', type: 'error' })
    }
    setLoading(false)
  }

  useEffect(() => { loadScreenshots() }, [])

  function handleOpenFolder() {
    window.electronAPI.screenshots.open()
  }

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}

      <div className="page-header">
        <h1 className="page-title">Screenshots</h1>
        <p className="page-subtitle">Browse your in-game screenshots</p>
        <button className="btn btn-ghost btn-sm" onClick={handleOpenFolder} style={{ marginTop: 8 }}>
          <FolderOpen size={14} /> Open folder
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}>
          <div className="spinner" />
        </div>
      ) : screenshots.length === 0 ? (
        <EmptyState
          icon={<Image size={28} />}
          text="No screenshots yet. Take one in-game with F2."
        >
          <button className="btn btn-ghost btn-sm" onClick={handleOpenFolder}>
            <FolderOpen size={14} /> Open screenshots folder
          </button>
        </EmptyState>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 16 }}>
          {screenshots.map(s => (
            <div
              key={s.name}
              className="screenshot-card"
              onClick={() => setPreview(s.path)}
              style={{ cursor: 'pointer' }}
            >
              <div className="screenshot-thumb">
                <img src={`file://${s.path}`} alt={s.name} loading="lazy" />
              </div>
              <div className="screenshot-info">
                <div className="screenshot-name">{s.name}</div>
                <div className="screenshot-meta">{formatDate(s.time)} · {formatSize(s.size)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)} style={{ zIndex: 5000 }}>
          <div className="modal" style={{ maxWidth: '90vw', maxHeight: '90vh', padding: 0, overflow: 'hidden', background: 'transparent' }} onClick={e => e.stopPropagation()}>
            <img src={`file://${preview}`} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', display: 'block', borderRadius: 'var(--radius-md)' }} />
          </div>
        </div>
      )}
    </div>
  )
}
