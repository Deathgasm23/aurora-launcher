import { useEffect, useRef, useState } from 'react'

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
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
  const [pos, setPos] = useState({ x, y })

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

  useEffect(() => {
    if (!open || !ref.current) return
    const el = ref.current
    const rect = el.getBoundingClientRect()
    let cx = x, cy = y
    if (rect.right > window.innerWidth) cx = window.innerWidth - rect.width - 8
    if (rect.bottom > window.innerHeight) cy = window.innerHeight - rect.height - 8
    setPos({ x: cx, y: cy })
  }, [open, x, y])

  if (!open) return null

  return (
    <div ref={ref} className="context-menu" style={{ left: pos.x, top: pos.y }}>
      {items.filter(item => !item.hidden).map((item, i) => (
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
