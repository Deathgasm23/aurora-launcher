import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Star, User, Clock, History } from 'lucide-react'
import type { MinecraftAccount, PlaytimeData } from '../../shared/types'
import Notification from '../components/common/Notification'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

interface AccountsProps {
  onAccountsChanged: () => void
}

function Accounts({ onAccountsChanged }: AccountsProps) {
  const [accounts, setAccounts] = useState<MinecraftAccount[]>([])
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null)
  const [showOfflineModal, setShowOfflineModal] = useState(false)
  const [offlineUsername, setOfflineUsername] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [playtime, setPlaytime] = useState<PlaytimeData | null>(null)

  async function loadAccounts() {
    try {
      const [accs, current, pt] = await Promise.all([
        window.electronAPI.auth.getAccounts(),
        window.electronAPI.auth.getCurrentAccount(),
        window.electronAPI.playtime.getStats().catch(() => null),
      ])
      setAccounts(accs)
      setCurrentAccountId(current?.id || null)
      if (pt) setPlaytime(pt)
    } catch {
      setNotif({ message: 'Failed to load accounts', type: 'error' })
    }
    setPageLoading(false)
  }

  useEffect(() => {
    loadAccounts()
    const onExit = () => {
      window.electronAPI.playtime.getStats().then(setPlaytime).catch(() => {})
    }
    window.electronAPI.onLaunchExit(onExit)
    return () => window.electronAPI.removeLaunchExitListener()
  }, [])

  async function handleOfflineLogin() {
    if (!offlineUsername.trim()) return
    setLoginLoading(true)
    const result = await window.electronAPI.auth.loginOffline(offlineUsername.trim())
    setLoginLoading(false)
    if (result.success) {
      setNotif({ message: `Logged in offline as ${result.account.username}`, type: 'success' })
      setShowOfflineModal(false)
      setOfflineUsername('')
      loadAccounts()
      onAccountsChanged()
    } else {
      setNotif({ message: result.error || 'Login failed', type: 'error' })
    }
  }

  async function handleSetCurrent(id: string) {
    await window.electronAPI.auth.setCurrentAccount(id)
    setCurrentAccountId(id)
    onAccountsChanged()
  }

  async function handleRemove(id: string) {
    setConfirmDelete(null)
    await window.electronAPI.auth.logout(id)
    loadAccounts()
    onAccountsChanged()
  }

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}

      <div className="page-header">
        <h1 className="page-title">Accounts</h1>
        <p className="page-subtitle">Manage your Minecraft accounts</p>
        <button className="btn btn-primary" onClick={() => setShowOfflineModal(true)} style={{ marginTop: 12 }}>
          <UserPlus size={14} /> Add Account
        </button>
      </div>

      {pageLoading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}>
          <div className="spinner" />
        </div>
      ) : (
      <>
      {accounts.length === 0 ? (
        <EmptyState
          icon={<User size={28} />}
          text="No accounts added. Add an offline account to play."
        >
          <button className="btn btn-primary" onClick={() => setShowOfflineModal(true)}>
            <UserPlus size={14} /> Add Account
          </button>
        </EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {accounts.map(acc => (
            <div
              key={acc.id}
              className={`account-card ${acc.id === currentAccountId ? 'active' : ''}`}
              onClick={() => handleSetCurrent(acc.id)}
            >
              <div className="skin-avatar">
                {acc.skinUrl ? (
                  <img src={acc.skinUrl} alt={`${acc.username} skin`} />
                ) : (
                  <div className="skin-avatar-placeholder">
                    {acc.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="account-info">
                <div className="account-name">{acc.username}</div>
                <div className="account-type">
                  Offline Account
                  {acc.uuid && ` · ${acc.uuid.slice(0, 8)}...`}
                </div>
                {playtime?.byAccount[acc.id] && (
                  <div className="account-playtime">
                    <Clock size={11} />
                    <span>{formatDuration(playtime.byAccount[acc.id].totalDuration)}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>{playtime.byAccount[acc.id].count} sessions</span>
                  </div>
                )}
              </div>
              {acc.id === currentAccountId && (
                <Star size={14} style={{ color: 'var(--warning)' }} />
              )}
              <div className="account-actions">
                <button
                  className="btn btn-ghost"
                  onClick={e => { e.stopPropagation(); setConfirmDelete(acc.id) }}
                  title="Remove account"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showOfflineModal}
        onClose={() => setShowOfflineModal(false)}
        title="Offline Login"
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowOfflineModal(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleOfflineLogin}
              disabled={!offlineUsername.trim() || offlineUsername.length > 16}
            >
              Login
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            className="input"
            placeholder="Enter username (max 16 chars)"
            value={offlineUsername}
            onChange={e => setOfflineUsername(e.target.value.slice(0, 16))}
            onKeyDown={e => e.key === 'Enter' && handleOfflineLogin()}
            autoFocus
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Letters, numbers, and underscores only
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Remove Account"
        message="This account will be permanently removed. You will need to add it again to use it."
        confirmLabel="Remove"
        onConfirm={() => handleRemove(confirmDelete!)}
        onCancel={() => setConfirmDelete(null)}
        danger
      />
      </>
      )}
    </div>
  )
}

export default Accounts
