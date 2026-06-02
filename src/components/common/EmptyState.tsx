interface EmptyStateProps {
  icon?: React.ReactNode
  text: string
  children?: React.ReactNode
}

const EmptyState = ({ icon, text, children }: EmptyStateProps) => {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="empty-state-text">{text}</p>
      {children && <div>{children}</div>}
    </div>
  )
}

export default EmptyState
