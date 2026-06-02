import { useState, useEffect } from 'react'
import { UserPlus, Trash2, Star, User } from 'lucide-react'
import type { MinecraftAccount } from '../../shared/types'
import Notification from '../components/common/Notification'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'

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

  async function loadAccounts() {
    try {
      const accs = await window.electronAPI.auth.getAccounts()
      setAccounts(accs)
      const current = await window.electronAPI.auth.getCurrentAccount()
      setCurrentAccountId(current?.id || null)
    } catch {
      setNotif({ message: 'Failed to load accounts', type: 'error' })
    }
    setPageLoading(false)
  }

  useEffect(() => { loadAccounts() }, [])

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
