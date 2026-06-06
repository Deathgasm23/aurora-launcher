import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleCardProps {
  icon: React.ReactNode
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  forceOpen?: boolean | null
}

export default function CollapsibleCard({ icon, title, defaultOpen = false, children, forceOpen = null }: CollapsibleCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = forceOpen !== null ? forceOpen : internalOpen

  return (
    <div className="card collapsible-card">
      <div className="card-header collapsible-header" onClick={() => { if (forceOpen === null) setInternalOpen(!internalOpen) }} style={{ cursor: 'pointer' }}>
        {icon}
        <span style={{ flex: 1 }}>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  )
}