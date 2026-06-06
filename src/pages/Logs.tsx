import { useState, useEffect, useRef } from 'react'
import { ScrollText, Trash2 } from 'lucide-react'
import type { LogEntry } from '../../shared/types'
import EmptyState from '../components/common/EmptyState'

function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  async function loadLogs() {
    const entries = await window.electronAPI.logs.getLogs()
    setLogs(entries)
  }

  useEffect(() => {
    loadLogs()

    const onOutput = () => loadLogs()
    const onError = () => loadLogs()
    const onExit = () => loadLogs()

    window.electronAPI.onLaunchOutput(onOutput)
    window.electronAPI.onLaunchError(onError)
    window.electronAPI.onLaunchExit(onExit)

    return () => {
      window.electronAPI.removeLaunchOutputListener()
      window.electronAPI.removeLaunchErrorListener()
      window.electronAPI.removeLaunchExitListener()
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function handleClear() {
    await window.electronAPI.logs.clearLogs()
    setLogs([])
  }

  function getLevelColor(level: string) {
    switch (level) {
      case 'error': return 'var(--error)'
      case 'warn': return 'var(--warning)'
      case 'info': return 'var(--accent)'
      case 'debug': return 'var(--text-muted)'
      default: return 'var(--text-secondary)'
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Logs</h1>
            <p className="page-subtitle">Troubleshooting and debug information</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleClear} disabled={logs.length === 0}>
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="console-output" style={{ flex: 1, maxHeight: 'none', border: 'none' }}>
          {logs.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>No log entries yet.</span>
          ) : (
            logs.map((entry, i) => (
              <div key={i} style={{ marginBottom: 3, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                {' '}
                <span style={{ color: getLevelColor(entry.level), fontWeight: 700, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  [{entry.level.toUpperCase()}]
                </span>
                {' '}
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  [{entry.source}]
                </span>
                {' '}
                <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{entry.message}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}

export default Logs
