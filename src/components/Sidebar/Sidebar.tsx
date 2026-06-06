import { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHome, faUser, faCodeBranch, faServer, faCamera, faBug, faScroll, faCog, faChevronDown, faNewspaper, faPaintbrush, faGlobe, faLayerGroup, faDatabase, faSun } from '@fortawesome/free-solid-svg-icons'
import { MinecraftAccount } from '../../../shared/types'

interface NavbarProps {
  activePage: string
  onNavigate: (page: string) => void
  newVersionsCount?: number
  onNewVersionsRead?: () => void
  accounts?: MinecraftAccount[]
  currentAccount?: MinecraftAccount | null
  onSwitchAccount?: (accountId: string) => void
}

interface DropdownGroup {
  id: string
  label: string
  icon: any
  children: { id: string; label: string; icon: any }[]
}

const dropdownGroups: DropdownGroup[] = [
  {
    id: 'content',
    label: 'CONTENT',
    icon: faLayerGroup,
    children: [
      { id: 'worlds', label: 'WORLDS', icon: faGlobe },
      { id: 'resource-packs', label: 'PACKS', icon: faPaintbrush },
      { id: 'shaderpacks', label: 'SHADERS', icon: faSun },
      { id: 'screenshots', label: 'CAPTURES', icon: faCamera },
    ],
  },
  {
    id: 'data',
    label: 'DATA',
    icon: faDatabase,
    children: [
      { id: 'crash-reports', label: 'CRASHES', icon: faBug },
      { id: 'logs', label: 'LOGS', icon: faScroll },
    ],
  },
]

const flatNavItems = [
  { id: 'home', label: 'HOME', icon: faHome },
  { id: 'news', label: 'NEWS', icon: faNewspaper },
  { id: 'accounts', label: 'ACCOUNTS', icon: faUser },
  { id: 'versions', label: 'VERSIONS', icon: faCodeBranch },
  { id: 'servers', label: 'SERVERS', icon: faServer },
  { id: 'settings', label: 'SETTINGS', icon: faCog },
]

export default function Navbar({ activePage, onNavigate, newVersionsCount, onNewVersionsRead, accounts = [], currentAccount, onSwitchAccount }: NavbarProps) {
  const [appVersion, setAppVersion] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dataRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.app.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (contentRef.current && !contentRef.current.contains(target) &&
          dataRef.current && !dataRef.current.contains(target)) {
        setDropdownOpen(null)
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function isChildActive(group: DropdownGroup) {
    return group.children.some(c => c.id === activePage)
  }

  return (
    <div className="navbar">
      <div className="navbar-brand">
        <div className="navbar-brand-icon">⚙</div>
        <span className="navbar-brand-text">AURORA</span>
      </div>
      <nav className="navbar-nav">
        {flatNavItems.map(item => (
          <button
            key={item.id}
            className={`navbar-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => { if (item.id === 'versions') onNewVersionsRead?.(); onNavigate(item.id) }}
          >
            <FontAwesomeIcon icon={item.icon} className="navbar-item-icon" />
            {item.label}
            {item.id === 'versions' && !!newVersionsCount && <span className="navbar-dot" />}
          </button>
        ))}

        {dropdownGroups.map(group => (
          <div key={group.id} className="navbar-dropdown" ref={group.id === 'content' ? contentRef : dataRef}>
            <button
              className={`navbar-item navbar-dropdown-btn ${isChildActive(group) ? 'active' : ''} ${dropdownOpen === group.id ? 'dropdown-open' : ''}`}
              onClick={() => setDropdownOpen(dropdownOpen === group.id ? null : group.id)}
            >
              <FontAwesomeIcon icon={group.icon} className="navbar-item-icon" />
              {group.label}
              <FontAwesomeIcon icon={faChevronDown} className={`navbar-dropdown-chevron ${dropdownOpen === group.id ? 'open' : ''}`} />
            </button>
            {dropdownOpen === group.id && (
              <div className="navbar-dropdown-menu">
                {group.children.map(child => (
                  <button
                    key={child.id}
                    className={`navbar-dropdown-item ${activePage === child.id ? 'active' : ''}`}
                    onClick={() => { onNavigate(child.id); setDropdownOpen(null) }}
                  >
                    <FontAwesomeIcon icon={child.icon} className="navbar-dropdown-item-icon" />
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="navbar-actions">
        {accounts.length > 1 && (
          <div className="navbar-account-dropdown" ref={dropdownRef}>
            <button className="navbar-account-btn" onClick={() => setAccountOpen(!accountOpen)}>
              <FontAwesomeIcon icon={faUser} className="navbar-account-icon" />
              <span className="navbar-account-name">{currentAccount?.username || 'No account'}</span>
              <FontAwesomeIcon icon={faChevronDown} className={`navbar-account-chevron ${accountOpen ? 'open' : ''}`} />
            </button>
            {accountOpen && (
              <div className="navbar-account-menu">
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    className={`navbar-account-menu-item ${acc.id === currentAccount?.id ? 'active' : ''}`}
                    onClick={() => { onSwitchAccount?.(acc.id); setAccountOpen(false) }}
                  >
                    <FontAwesomeIcon icon={faUser} className="navbar-account-menu-icon" />
                    {acc.username}
                    {acc.id === currentAccount?.id && <span className="navbar-account-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <span className="navbar-version">
          v{appVersion || '1.2.8'}
        </span>
      </div>
    </div>
  )
}