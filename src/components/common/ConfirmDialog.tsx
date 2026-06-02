import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, danger }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{message}</p>
    </Modal>
  )
}
