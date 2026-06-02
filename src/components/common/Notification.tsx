import { useEffect } from 'react'
import { CheckCircle, XCircle, Info } from 'lucide-react'

interface NotificationProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const Notification = ({ message, type, onClose }: NotificationProps) => {
  const Icon = icons[type]

  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`notification ${type}`}>
      <Icon size={16} style={{ flexShrink: 0 }} />
      {message}
    </div>
  )
}

export default Notification
