import { useState, useEffect } from 'react'
import { Image, FolderOpen, Trash2, Eye, Copy, FolderUp, Upload } from 'lucide-react'
import type { ScreenshotEntry } from '../../shared/types'
import Notification from '../components/common/Notification'
import EmptyState from '../components/common/EmptyState'
import ContextMenu from '../components/common/ContextMenu'

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; screenshot: ScreenshotEntry } | null>(null)

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

  async function handleDelete(path: string) {
    const result = await window.electronAPI.screenshots.delete(path)
    if (result.success) {
      setScreenshots(prev => prev.filter(s => s.path !== path))
      setNotif({ message: 'Screenshot deleted', type: 'success' })
    } else {
      setNotif({ message: result.error || 'Failed to delete', type: 'error' })
    }
  }

  function handleShowInFolder(path: string) {
    window.electronAPI.shell.showItemInFolder(path)
  }

  async function handleCopyPhoto(path: string) {
    const result = await window.electronAPI.screenshots.copyImage(path)
    if (result.success) {
      setNotif({ message: 'Screenshot copied', type: 'info' })
    } else {
      setNotif({ message: result.error || 'Failed to copy', type: 'error' })
    }
  }

  async function handleUploadImgur(path: string) {
    setNotif({ message: 'Uploading to Imgur...', type: 'info' })
    const result = await window.electronAPI.screenshots.uploadImgur(path)
    if (result.success && result.url) {
      await navigator.clipboard.writeText(result.url)
      setNotif({ message: `Uploaded! URL copied: ${result.url}`, type: 'success' })
    } else {
      setNotif({ message: result.error || 'Upload failed', type: 'error' })
    }
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
              onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, screenshot: s }) }}
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

      <ContextMenu
        open={!!contextMenu}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={() => setContextMenu(null)}
        items={contextMenu ? [
          { label: 'View', icon: <Eye size={12} />, onClick: () => setPreview(contextMenu.screenshot.path) },
          { label: 'Show in Folder', icon: <FolderUp size={12} />, onClick: () => handleShowInFolder(contextMenu.screenshot.path) },
          { label: 'Copy Photo', icon: <Copy size={12} />, onClick: () => handleCopyPhoto(contextMenu.screenshot.path) },
          { label: 'Upload Imgur', icon: <Upload size={12} />, onClick: () => handleUploadImgur(contextMenu.screenshot.path) },
          { label: 'Delete', icon: <Trash2 size={12} />, onClick: () => handleDelete(contextMenu.screenshot.path), danger: true },
        ] : []}
      />

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)} style={{ maxWidth: 'none', width: '100vw', zIndex: 5000 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '90vw', maxHeight: '90vh', padding: 0, overflow: 'hidden', background: 'transparent' }} onClick={e => e.stopPropagation()}>
            <img src={`file://${preview}`} alt="" style={{ maxWidth: '100%', maxHeight: '85vh', display: 'block', borderRadius: 'var(--radius-md)' }} />
          </div>
        </div>
      )}
    </div>
  )
}
