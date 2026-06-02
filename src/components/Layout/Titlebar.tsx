import { Minus, Square, X } from 'lucide-react'

export default function Titlebar() {
  const handleMinimize = () => window.electronAPI.window.minimize()
  const handleMaximize = () => window.electronAPI.window.maximize()
  const handleClose = () => window.electronAPI.window.close()

  return (
    <div className="titlebar">
      <div className="titlebar-title">Aurora Launcher</div>
      <div className="titlebar-drag" />
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={handleMinimize} title="Minimize"><Minus size={14} /></button>
        <button className="titlebar-btn" onClick={handleMaximize} title="Maximize"><Square size={12} /></button>
        <button className="titlebar-btn close" onClick={handleClose} title="Close"><X size={14} /></button>
      </div>
    </div>
  )
}
