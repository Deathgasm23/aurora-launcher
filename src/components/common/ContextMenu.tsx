import { useEffect, useRef } from 'react'

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  open: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ open, x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      {items.map((item, i) => (
        <button
          key={i}
          className={`context-menu-item ${item.danger ? 'danger' : ''}`}
          disabled={item.disabled}
          onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
