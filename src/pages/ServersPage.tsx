import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Globe, Wifi, WifiOff, Users, RefreshCw, Loader2, Signal, SignalHigh, SignalLow, Zap, Edit3 } from 'lucide-react'
import type { ServerEntry, MinecraftAccount, ServerStatus, InstallProgress } from '../../shared/types'
import Notification from '../components/common/Notification'
import Modal from '../components/common/Modal'

interface ServersPageProps {
  currentAccount: MinecraftAccount | null
}

export default function ServersPage({ currentAccount }: ServersPageProps) {
  const [servers, setServers] = useState<ServerEntry[]>([])
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newPort, setNewPort] = useState(25565)
  const [newVersion, setNewVersion] = useState('')
  const [statuses, setStatuses] = useState<Record<string, ServerStatus>>({})
  const [pinging, setPinging] = useState<Record<string, boolean>>({})
  const [addStatus, setAddStatus] = useState<ServerStatus | null>(null)
  const [addPinging, setAddPinging] = useState(false)
  const [editServer, setEditServer] = useState<ServerEntry | null>(null)
  const [editVersion, setEditVersion] = useState('')
  const [pendingPlay, setPendingPlay] = useState<ServerEntry | null>(null)
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null)
  const [accountsLoading, setAccountsLoading] = useState(false)

  async function loadServers() {
    try {
      const [list, accs] = await Promise.all([
        window.electronAPI.servers.list(),
        window.electronAPI.auth.getAccounts(),
      ])
      setServers(list)
      setAccounts(accs)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadServers() }, [])

  const pingServer = useCallback(async (id: string, address: string, port: number) => {
    setPinging(prev => ({ ...prev, [id]: true }))
    const status = await window.electronAPI.servers.ping(address, port)
    setStatuses(prev => ({ ...prev, [id]: status }))
    setPinging(prev => ({ ...prev, [id]: false }))
  }, [])

  useEffect(() => {
    if (servers.length > 0) {
      servers.forEach(s => pingServer(s.id, s.address, s.port))
    }
  }, [servers, pingServer])

  async function handleAdd() {
    if (!newName.trim() || !newAddress.trim() || !newVersion.trim()) return
    const entry: ServerEntry = {
      id: Date.now().toString(),
      name: newName.trim(),
      address: newAddress.trim(),
      port: newPort,
      version: newVersion.trim(),
    }
    const updated = [...servers, entry]
    await window.electronAPI.servers.save(updated)
    setServers(updated)
    setShowAdd(false)
    setNewName('')
    setNewAddress('')
    setNewPort(25565)
    setNewVersion('')
    setAddStatus(null)
    setNotif({ message: 'Server added', type: 'success' })
  }

  async function handleRemove(id: string) {
    const updated = servers.filter(s => s.id !== id)
    await window.electronAPI.servers.save(updated)
    setServers(updated)
  }

  async function handleQuickPlay(server: ServerEntry, accountId?: string) {
    const accId = accountId || currentAccount?.id
    if (!accId) {
      setNotif({ message: 'Select an account first', type: 'error' })
      return
    }
    const versionId = server.version
    if (!versionId) {
      setNotif({ message: 'This server has no version set. Edit it and add a version.', type: 'error' })
      return
    }
    const installed = await window.electronAPI.versions.getInstalledVersions()
    if (!installed.includes(versionId)) {
      window.electronAPI.versions.onInstallProgress((progress: InstallProgress) => {
        setInstallProgress(progress)
      })
      const result = await window.electronAPI.versions.installVersion(versionId)
      window.electronAPI.versions.removeInstallProgressListener()
      setInstallProgress(null)
      if (!result.success) {
        setNotif({ message: result.error || `Failed to install ${versionId}`, type: 'error' })
        return
      }
    }
    await window.electronAPI.launch.setLastVersion(versionId)
    const result = await window.electronAPI.launch.launchGameWithExtras(accId, versionId, {
      serverAddress: server.address,
      serverPort: server.port,
    })
    if (!result.success) {
      setNotif({ message: result.error || 'Launch failed', type: 'error' })
    }
  }

  function handlePlayClick(server: ServerEntry) {
    if (!currentAccount && accounts.length === 0) {
      setNotif({ message: 'Add an account first', type: 'error' })
      return
    }
    if (accounts.length > 1) {
      setPendingPlay(server)
      return
    }
    handleQuickPlay(server)
  }

  async function handlePlayAs(accountId: string) {
    if (!pendingPlay) return
    const server = pendingPlay
    setPendingPlay(null)
    await handleQuickPlay(server, accountId)
  }

  async function handlePingPreview() {
    if (!newAddress.trim()) return
    setAddPinging(true)
    setAddStatus(null)
    const status = await window.electronAPI.servers.ping(newAddress.trim(), newPort)
    setAddStatus(status)
    setAddPinging(false)
  }

  async function handleEdit() {
    if (!editServer || !editVersion.trim()) return
    const updated = servers.map(s => s.id === editServer.id ? { ...s, version: editVersion.trim() } : s)
    await window.electronAPI.servers.save(updated)
    setServers(updated)
    setEditServer(null)
    setNotif({ message: 'Server updated', type: 'success' })
  }

  const stripColorCodes = (text: string) => text.replace(/§[0-9a-fk-or]/g, '')

  function latencyIcon(ms: number) {
    if (ms < 30) return <SignalHigh size={14} style={{ color: 'var(--success)' }} />
    if (ms < 100) return <Signal size={14} style={{ color: 'var(--accent)' }} />
    return <SignalLow size={14} style={{ color: 'var(--warning)' }} />
  }

  function formatLatency(ms: number) {
    if (ms < 1) return '<1ms'
    return `${ms}ms`
  }

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}
      <div className="page-header">
        <h1 className="page-title">Servers</h1>
        <p className="page-subtitle">Quick-launch into your favorite servers</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}><div className="spinner" /></div>
      ) : (
      <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted">{servers.length} server(s)</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(true); setAddStatus(null) }}>
          <Plus size={14} /> Add Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <Globe size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div>No servers saved. Add a server to quick-play.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {servers.map(s => {
            const status = statuses[s.id]
            const pingingNow = pinging[s.id]
            return (
              <div key={s.id} className="server-card">
                <div className="server-card-top">
                  <div className="server-card-icon">
                    {status?.icon ? (
                      <img src={status.icon} alt="" className="server-icon-img" />
                    ) : s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="server-card-info">
                    <div className="server-card-name">{s.name}</div>
                    <div className="server-card-address">{s.address}:{s.port}</div>
                  </div>
                  <div className="server-card-actions">
                    <button className="btn btn-ghost btn-xs" onClick={() => pingServer(s.id, s.address, s.port)} title="Refresh status" disabled={pingingNow}>
                      <RefreshCw size={12} className={pingingNow ? 'spinner' : ''} />
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => handlePlayClick(s)}
                      disabled={accounts.length === 0 || pingingNow} title={accounts.length === 0 ? 'Add an account first' : 'Quick Play'}>
                      <Zap size={13} /> Play
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => { setEditServer(s); setEditVersion(s.version || '') }} title="Edit">
                      <Edit3 size={12} />
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => handleRemove(s.id)} title="Remove server" style={{ color: 'var(--error)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {status && (
                  <div className="server-card-body">
                    {status.online ? (
                      <>
                        {status.motd && (
                          <div className="server-motd">{stripColorCodes(status.motd)}</div>
                        )}
                        <div className="server-stats">
                          <span className="server-stat">
                            <Wifi size={12} /> Online
                          </span>
                          {status.players && (
                            <span className="server-stat">
                              <Users size={12} /> {status.players.online}/{status.players.max} players
                            </span>
                          )}
                          <span className="server-stat">
                            {latencyIcon(status.latency)} {formatLatency(status.latency)}
                          </span>
                          {status.version && (
                            <span className="server-stat">
                              <span style={{ fontWeight: 600 }}>{stripColorCodes(status.version)}</span>
                            </span>
                          )}
                          {s.version && (
                            <span className="server-stat server-stat-tag">{s.version}</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="server-card-offline">
                        <WifiOff size={14} />
                        <span>Server is offline or unreachable</span>
                        <span className="text-xs text-muted">{status.latency > 0 ? `${formatLatency(status.latency)}` : ''}</span>
                      </div>
                    )}
                  </div>
                )}
                {!status && !pingingNow && (
                  <div className="server-card-body">
                    <div className="server-card-offline" style={{ color: 'var(--text-muted)' }}>
                      <Loader2 size={14} className="spinner" />
                      <span>Pinging server...</span>
                    </div>
                  </div>
                )}
                {pingingNow && !status && (
                  <div className="server-card-body">
                    <div className="server-card-offline" style={{ color: 'var(--text-muted)' }}>
                      <Loader2 size={14} className="spinner" />
                      <span>Pinging server...</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={() => { setShowAdd(false); setAddStatus(null) }} title="Add Server"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setAddStatus(null) }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!newName.trim() || !newAddress.trim() || !newVersion.trim()}>Add</button>
          </>
        }>
        <div className="form-group">
          <label className="form-label">Server Name</label>
          <input className="input" placeholder="My Server" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Address</label>
            <div className="flex gap-2">
              <input className="input" placeholder="mc.example.com" value={newAddress}
                onChange={e => { setNewAddress(e.target.value); setAddStatus(null) }}
                style={{ flex: 1 }} />
              <button className="btn btn-secondary btn-sm" onClick={handlePingPreview} disabled={!newAddress.trim() || addPinging}>
                {addPinging ? <Loader2 size={12} className="spinner" /> : <Wifi size={12} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Port</label>
            <input className="input" type="number" value={newPort} onChange={e => { setNewPort(parseInt(e.target.value) || 25565); setAddStatus(null) }} min={1} max={65535} />
          </div>
        </div>
        {addPinging && (
          <div className="flex items-center gap-2 text-sm text-muted" style={{ marginBottom: 12 }}>
            <Loader2 size={14} className="spinner" /> Pinging server...
          </div>
        )}
        {addStatus && (
          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            {addStatus.online ? (
              <div className="flex items-start gap-3">
                {addStatus.icon && (
                  <img src={addStatus.icon} alt="" style={{ width: 48, height: 48, imageRendering: 'pixelated', borderRadius: 4 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2">
                    <Wifi size={14} style={{ color: 'var(--success)' }} />
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>Online</span>
                    <span className="text-muted" style={{ fontSize: 11 }}>{addStatus.latency}ms</span>
                  </div>
                  {addStatus.motd && (
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>{stripColorCodes(addStatus.motd)}</div>
                  )}
                  <div className="flex items-center gap-3" style={{ marginTop: 4, fontSize: 11 }}>
                    {addStatus.players && (
                      <span className="flex items-center gap-1"><Users size={11} /> {addStatus.players.online}/{addStatus.players.max} players</span>
                    )}
                    {addStatus.version && <span style={{ color: 'var(--text-muted)' }}>{stripColorCodes(addStatus.version)}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <WifiOff size={14} style={{ color: 'var(--error)' }} />
                <span style={{ color: 'var(--error)' }}>Server is offline or unreachable</span>
              </div>
            )}
          </div>
        )}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Minecraft Version <span style={{ color: 'var(--error)' }}>*</span></label>
          <input className="input" placeholder="e.g. 1.20.4" value={newVersion} onChange={e => setNewVersion(e.target.value)} />
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>Required. Auto-downloaded if not installed.</div>
        </div>
      </Modal>

      <Modal open={editServer !== null} onClose={() => setEditServer(null)} title={editServer ? `Edit: ${editServer.name}` : ''}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setEditServer(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleEdit} disabled={!editVersion.trim()}>Save</button>
          </>
        }>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Minecraft Version <span style={{ color: 'var(--error)' }}>*</span></label>
          <input className="input" placeholder="e.g. 1.20.4" value={editVersion} onChange={e => setEditVersion(e.target.value)} autoFocus />
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>This version will be auto-downloaded on Play if missing.</div>
        </div>
      </Modal>
      {installProgress && (
        <div className="modal-overlay" style={{ zIndex: 5000 }}>
          <div className="modal" style={{ maxWidth: 440, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{installProgress.status === 'done' ? 'Installed' : 'Installing...'}</h2>
            <p className="text-sm text-muted" style={{ marginBottom: 16 }}>{installProgress.message}</p>
            <div className="progress-bar" style={{ width: '100%', height: 8 }}>
              <div className="progress-fill" style={{ width: `${installProgress.progress}%` }} />
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 8 }}>{installProgress.progress}%</div>
          </div>
        </div>
      )}
      <Modal
        open={pendingPlay !== null}
        onClose={() => setPendingPlay(null)}
        title="Choose Account"
        actions={
          <button className="btn btn-secondary" onClick={() => setPendingPlay(null)}>
            Cancel
          </button>
        }
      >
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Select which account to use for this server:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {accounts.map(acc => (
            <button
              key={acc.id}
              className="card"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                cursor: 'pointer', textAlign: 'left', width: '100%', border: 'none',
              }}
              onClick={() => handlePlayAs(acc.id)}
            >
              <div className="skin-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
                {acc.username.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontWeight: 500 }}>{acc.username}</span>
              {acc.id === currentAccount?.id && (
                <span className="text-xs text-accent" style={{ marginLeft: 'auto' }}>Current</span>
              )}
            </button>
          ))}
        </div>
      </Modal>
      </>
      )}
    </div>
  )
}
