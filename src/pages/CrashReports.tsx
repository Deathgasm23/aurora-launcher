import { useState, useEffect } from 'react'
import { AlertTriangle, FileText, Trash2, RefreshCw } from 'lucide-react'
import type { CrashReport } from '../../shared/types'
import Notification from '../components/common/Notification'

function CrashReports() {
  const [reports, setReports] = useState<CrashReport[]>([])
  const [loading, setLoading] = useState(true)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [selected, setSelected] = useState<CrashReport | null>(null)
  const [content, setContent] = useState('')

  async function loadReports() {
    try {
      const list = await window.electronAPI.crashReports.list()
      setReports(list)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadReports() }, [])

  async function handleSelect(report: CrashReport) {
    setSelected(report)
    const result = await window.electronAPI.crashReports.get(report.path)
    setContent(result.content)
  }

  return (
    <div className="page-container">
      {notif && <Notification {...notif} onClose={() => setNotif(null)} />}
      <div className="page-header">
        <h1 className="page-title">Crash Reports</h1>
        <p className="page-subtitle">View and analyze game crash logs</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}><div className="spinner" /></div>
      ) : (
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
        <div style={{ width: 280, flexShrink: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted">{reports.length} report(s)</span>
            <button className="btn btn-ghost btn-sm" onClick={loadReports}><RefreshCw size={14} /></button>
          </div>
          {reports.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertTriangle size={28} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div className="text-sm">No crash reports</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {reports.map(r => (
                <div key={r.title} className={`version-card ${selected?.title === r.title ? 'active' : ''}`}
                  onClick={() => handleSelect(r)} style={{ cursor: 'pointer' }}>
                  <div className="version-info">
                    <div className="version-name" style={{ fontSize: 12 }}>{r.title}</div>
                    <div className="version-date">{new Date(r.time).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <>
              <div className="section-title" style={{ marginBottom: 8, flexShrink: 0 }}>{selected.title}</div>
              <div className="console-output" style={{ flex: 1, fontSize: 11 }}>
                {content || 'Loading...'}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center" style={{ flex: 1, color: 'var(--text-muted)' }}>
              Select a crash report to view
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

export default CrashReports
