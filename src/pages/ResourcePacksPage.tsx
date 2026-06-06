import { useState, useEffect } from 'react'
import { Trash2, FolderOpen, Paintbrush, RefreshCw, Folder, Globe, Download, Search, Loader2, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import Notification from '../components/common/Notification'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Modal from '../components/common/Modal'

interface ModrinthHit {
  project_id: string
  slug?: string
  title: string
  description: string
  icon_url: string
  author: string
  downloads: number
  follows: number
  latest_version: string
  versions: string[]
  date_modified: string
}

const GAME_VERSIONS = ['26.1', '1.21.11', '1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4', '1.21.3', '1.21.2', '1.21.1', '1.21', '1.20.6', '1.20.5', '1.20.4', '1.20.3', '1.20.2', '1.20.1', '1.20', '1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19', '1.18.2', '1.18.1', '1.18', '1.17.1', '1.17', '1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1']
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'downloads', label: 'Most Downloaded' },
  { value: 'follows', label: 'Most Follows' },
  { value: 'newest', label: 'Newest' },
  { value: 'updated', label: 'Recently Updated' },
]

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ResourcePacksPage() {
  const [packs, setPacks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showInstalled, setShowInstalled] = useState(true)
  const [destinationDir, setDestinationDir] = useState('')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ModrinthHit[]>([])
  const [searching, setSearching] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [filterVersion, setFilterVersion] = useState('')
  const [sortIndex, setSortIndex] = useState('relevance')
  const [pendingInstall, setPendingInstall] = useState<ModrinthHit | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{ [projectId: string]: number }>({})

  useEffect(() => {
    loadPacks()
    window.electronAPI.settings.get().then(s => setDestinationDir(s.minecraftDirectory + '/resourcepacks'))
    handleSearch('')
    const handler = (p: { projectId: string; bytes: number; total: number }) => {
      const pct = p.total > 0 ? Math.round((p.bytes / p.total) * 100) : 0
      setDownloadProgress(dp => ({ ...dp, [p.projectId]: pct }))
    }
    window.electronAPI.modrinth.onDownloadProgress(handler)
    return () => window.electronAPI.modrinth.removeDownloadProgressListener()
  }, [])

  async function loadPacks() {
    setLoading(true)
    try {
      const list = await window.electronAPI.resourcePacks.list()
      setPacks(list)
    } catch {}
    setLoading(false)
  }

  async function handleDelete(path: string) {
    const result = await window.electronAPI.resourcePacks.delete(path)
    if (result.success) {
      setNotif({ message: 'Resource pack deleted', type: 'success' })
      loadPacks()
    } else {
      setNotif({ message: result.error || 'Failed to delete', type: 'error' })
    }
    setConfirmDelete(null)
  }

  async function handleSearch(q?: string, versionOv?: string, sortOv?: string) {
    const term = (q ?? query).trim()
    const vFilter = versionOv !== undefined ? versionOv : filterVersion
    const sFilter = sortOv !== undefined ? sortOv : sortIndex
    setSearching(true)
    setSearchError(null)
    setSearched(true)
    try {
      const versions = vFilter ? [vFilter] : undefined
      const res = await window.electronAPI.modrinth.search(term, 'resourcepack', 20, sFilter !== 'relevance' ? sFilter : undefined, versions)
      if (res.success && res.hits) {
        setResults(res.hits)
      } else {
        setSearchError(res.error || 'Search failed')
      }
    } catch {
      setSearchError('Search failed')
    }
    setSearching(false)
  }

  async function handleInstall(projectId: string) {
    setInstalling(projectId)
    setSearchError(null)
    setDownloadProgress(dp => ({ ...dp, [projectId]: 0 }))
    try {
      const res = await window.electronAPI.modrinth.install(projectId, destinationDir)
      if (res.success) {
        setNotif({ message: `Installed "${res.fileName || 'pack'}"`, type: 'success' })
        loadPacks()
      } else {
        setSearchError(res.error || 'Install failed')
      }
    } catch {
      setSearchError('Install failed')
    }
    setInstalling(null)
    setDownloadProgress(dp => { const n = { ...dp }; delete n[projectId]; return n })
  }

  function openProject(hit: ModrinthHit) {
    window.electronAPI.shell.openExternal(`https://modrinth.com/project/${hit.project_id}`)
  }

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}
      <div className="page-header">
        <h1 className="page-title">Resource Packs</h1>
        <p className="page-subtitle">Browse Modrinth or manage installed packs</p>
      </div>

      {/* Modrinth search */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-2" style={{ padding: '8px 12px' }}>
          <Globe size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <input className="input" style={{ flex: 1, border: 'none', background: 'transparent', padding: '4px 0' }}
            placeholder="Search resource packs on Modrinth..."
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <button className="btn btn-primary btn-sm" onClick={() => handleSearch()} disabled={searching}>
            {searching ? <Loader2 size={12} className="spinner" /> : <Search size={12} />} Search
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.electronAPI.resourcePacks.openFolder()}>
            <Folder size={14} /> Open Folder
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2" style={{ padding: '4px 12px 8px' }}>
          <select className="input" style={{ width: 130, fontSize: 12, padding: '3px 6px' }} value={filterVersion}
            onChange={e => { const v = e.target.value; setFilterVersion(v); handleSearch(undefined, v) }}>
            <option value="">All versions</option>
            {GAME_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select className="input" style={{ width: 140, fontSize: 12, padding: '3px 6px' }} value={sortIndex}
            onChange={e => { const v = e.target.value; setSortIndex(v); handleSearch(undefined, undefined, v) }}>
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {searchError && (
          <div style={{ padding: '2px 12px 6px', color: 'var(--error)', fontSize: 12 }}>{searchError}</div>
        )}

        {searching && (
          <div className="flex items-center justify-center" style={{ padding: 24 }}><div className="spinner" /></div>
        )}

        {!searching && searched && results.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No resource packs found. Try different filters.
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '2px 6px 8px', maxHeight: 380, overflowY: 'auto' }}>
            {results.map(hit => (
              <div key={hit.project_id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', cursor: 'pointer' }}
                onClick={() => openProject(hit)}>
                {hit.icon_url ? (
                  <img src={hit.icon_url} alt="" style={{ width: 28, height: 28, borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--bg-secondary)', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-1">
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{hit.title}</span>
                    <ExternalLink size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.description}</div>
                  <div className="flex items-center gap-2" style={{ marginTop: 1 }}>
                    <span className="text-xs text-muted">{formatDownloads(hit.downloads)} downloads</span>
                    <span className="text-xs text-muted">· {hit.author}</span>
                    <span className="text-xs text-muted">· {hit.latest_version}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {installing === hit.project_id && downloadProgress[hit.project_id] !== undefined && (
                    <div style={{
                      width: 50, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', flexShrink: 0
                    }}>
                      <div style={{
                        width: `${downloadProgress[hit.project_id]}%`, height: '100%',
                        background: 'var(--accent)', transition: 'width 200ms'
                      }} />
                    </div>
                  )}
                  <button className="btn btn-primary btn-xs" onClick={e => { e.stopPropagation(); setPendingInstall(hit) }}
                    disabled={installing === hit.project_id}>
                    {installing === hit.project_id ? (downloadProgress[hit.project_id] !== undefined ? `${downloadProgress[hit.project_id]}%` : <Loader2 size={11} className="spinner" />) : <Download size={11} />} Install
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Installed packs */}
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowInstalled(!showInstalled)}
          style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
          {showInstalled ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Installed ({packs.length})
        </button>
        <button className="btn btn-ghost btn-sm" onClick={loadPacks}><RefreshCw size={12} /></button>
      </div>

      {showInstalled && (
        loading ? (
          <div className="flex items-center justify-center" style={{ padding: 32 }}><div className="spinner" /></div>
        ) : packs.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Paintbrush size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            <div style={{ fontSize: 13 }}>No packs installed. Search and install from Modrinth above.</div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => window.electronAPI.resourcePacks.openFolder()}>
              <FolderOpen size={14} /> Open Resourcepacks Folder
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {packs.map((pack, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px' }}>
                <Paintbrush size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pack.name}</div>
                  <div className="flex items-center gap-3" style={{ marginTop: 1 }}>
                    <span className="text-xs text-muted">{formatSize(pack.size)}</span>
                    <span className="text-xs text-muted">{pack.isDirectory ? 'Folder' : 'Zip'}</span>
                    <span className="text-xs text-muted">{new Date(pack.modified).toLocaleDateString()}</span>
                  </div>
                </div>
                <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDelete(pack.path)} style={{ color: 'var(--error)' }} title="Delete">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      <Modal open={pendingInstall !== null}
        onClose={() => setPendingInstall(null)}
        title={`Install "${pendingInstall?.title || ''}"`}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setPendingInstall(null)}>Cancel</button>
            <button className="btn btn-secondary" onClick={() => { const h = pendingInstall; setPendingInstall(null); if (h) openProject(h) }}>View on Modrinth</button>
            <button className="btn btn-primary" onClick={() => { const h = pendingInstall; setPendingInstall(null); if (h) handleInstall(h.project_id) }}
              disabled={installing === pendingInstall?.project_id}>
              {installing === pendingInstall?.project_id ? <><Loader2 size={12} className="spinner" /> Installing...</> : <><Download size={12} /> Install anyway</>}
            </button>
          </>
        }>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
          Do you have all requirements? If not, press the button to go to the mod page.
        </p>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Resource Pack"
        message="Are you sure you want to delete this resource pack? This cannot be undone."
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
