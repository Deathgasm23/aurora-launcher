import { useState, useEffect, useRef, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHome, faUser, faCodeBranch, faServer, faCamera, faBug, faScroll, faCog } from '@fortawesome/free-solid-svg-icons'

interface CommandItem {
  id: string
  label: string
  sublabel?: string
  category: string
  icon?: any
  action: () => void
}

interface CommandPaletteProps {
  onNavigate: (page: string) => void
}

const pageIcons: Record<string, any> = {
  home: faHome, accounts: faUser, versions: faCodeBranch,
  servers: faServer, screenshots: faCamera, 'crash-reports': faBug,
  logs: faScroll, settings: faCog,
}

const pageLabels: Record<string, string> = {
  home: 'Home', accounts: 'Accounts', versions: 'Versions',
  servers: 'Servers', screenshots: 'Captures', 'crash-reports': 'Crash Reports',
  logs: 'Logs', settings: 'Settings',
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let qi = 0
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++
  }
  return qi === q.length
}

export default function CommandPalette({ onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<CommandItem[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)

  const buildItems = useCallback(async () => {
    const out: CommandItem[] = []

    for (const [id, label] of Object.entries(pageLabels)) {
      out.push({
        id: 'page-' + id, label, category: 'Pages',
        action: () => { onNavigate(id); setOpen(false) },
      })
    }

    try {
      const manifest = await window.electronAPI.versions.getManifest()
      if (manifest?.versions) {
        for (const v of manifest.versions.slice(0, 50)) {
          out.push({
            id: 'ver-' + v.id, label: v.id, sublabel: v.type,
            category: 'Versions', icon: faCodeBranch,
            action: () => { onNavigate('versions'); setOpen(false) },
          })
        }
      }
    } catch {}

    try {
      const servers = await window.electronAPI.servers.list()
      if (Array.isArray(servers)) {
        for (const s of servers) {
          out.push({
            id: 'srv-' + s.id, label: s.name, sublabel: `${s.address}:${s.port}`,
            category: 'Servers', icon: faServer,
            action: () => { onNavigate('servers'); setOpen(false) },
          })
        }
      }
    } catch {}

    setItems(out)
  }, [onNavigate])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        setQuery('')
        setSelectedIdx(0)
        if (!open) buildItems()
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, buildItems])

  useEffect(() => {
    if (open) {
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  const filtered = items.filter(item =>
    !query || fuzzyMatch(item.label, query) || (item.sublabel && fuzzyMatch(item.sublabel, query))
  )

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const categoryOrder = ['Pages', 'Versions', 'Servers']
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault()
      filtered[selectedIdx].action()
    }
  }

  if (!open) return null

  return (
    <div className="command-palette-overlay" onClick={() => setOpen(false)}>
      <div className="command-palette" ref={paletteRef} onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder="Search pages, versions, servers..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="command-palette-results">
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No results for "{query}"
            </div>
          )}
          {sortedCategories.map(cat => (
            <div key={cat}>
              <div className="command-palette-group-label">{cat}</div>
              {grouped[cat].map((item, i) => {
                const globalIdx = filtered.indexOf(item)
                return (
                  <button
                    key={item.id}
                    className={`command-palette-item ${globalIdx === selectedIdx ? 'selected' : ''}`}
                    onMouseEnter={() => setSelectedIdx(globalIdx)}
                    onClick={() => item.action()}
                  >
                    <span className="command-palette-item-icon">
                      <FontAwesomeIcon icon={item.icon || (pageIcons as any)[item.id.replace('page-', '')] || faHome} size="sm" />
                    </span>
                    <span className="command-palette-item-text">{item.label}</span>
                    {item.sublabel && <span className="command-palette-item-sub">{item.sublabel}</span>}
                    {item.id.startsWith('page-') && (
                      <span className="command-palette-kbd">
                        {Object.entries({ 1: 'home', 2: 'accounts', 3: 'versions', 4: 'settings', 5: 'logs', 6: 'servers', 8: 'screenshots' })
                          .find(([,pid]) => pid === item.id.replace('page-', ''))?.[0] !== undefined
                          ? `Ctrl+${Object.entries({ 1: 'home', 2: 'accounts', 3: 'versions', 4: 'settings', 5: 'logs', 6: 'servers', 8: 'screenshots' }).find(([,pid]) => pid === item.id.replace('page-', ''))![0]}`
                          : ''}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
