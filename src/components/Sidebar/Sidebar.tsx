import { useState, useEffect } from 'react'
import { Home, Users, Package, Settings, ScrollText, Gem, Zap, Server, AlertTriangle, Image, ExternalLink } from 'lucide-react'

interface NavbarProps {
  activePage: string
  onNavigate: (page: string) => void
  newVersionsCount?: number
  onNewVersionsRead?: () => void
}

const navItems = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'versions', label: 'Versions', icon: Package },
  { id: 'screenshots', label: 'Screenshots', icon: Image },
  { id: 'servers', label: 'Servers', icon: Server },
  { id: 'crash-reports', label: 'Crashes', icon: AlertTriangle },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ activePage, onNavigate, newVersionsCount, onNewVersionsRead }: NavbarProps) {
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  return (
    <div className="navbar">
      <div className="navbar-brand">
        <div className="navbar-brand-icon"><Gem size={16} /></div>
        <span className="navbar-brand-text">Aurora</span>
      </div>
      <nav className="navbar-nav">
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => { if (item.id === 'versions') onNewVersionsRead?.(); onNavigate(item.id) }}
            >
              <span className="nav-item-icon">
                <Icon size={16} />
                {item.id === 'versions' && !!newVersionsCount && <span className="nav-dot" />}
              </span>
              <span className="nav-item-label">{item.label}</span>
              {activePage === item.id && <span className="nav-item-indicator" />}
            </button>
          )
        })}
      </nav>
      <div className="navbar-meta">
        <Zap size={12} />
        <span>v{appVersion || '1.2.8'}</span>
        <button className="navbar-github-link" onClick={() => window.electronAPI.shell.openExternal('https://github.com/Deathgasm23/aurora-launcher')} title="GitHub">
          <ExternalLink size={11} />
          <span>GitHub</span>
        </button>
      </div>
    </div>
  )
}
