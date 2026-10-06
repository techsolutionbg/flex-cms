import { LoadingButton } from "@/components/loading-button"
import { AlertTriangle, X } from "lucide-react"
import { createPortal } from "react-dom"
import { useEffect } from "react"

type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Потвърди",
  cancelLabel = "Отказ",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, busy, onCancel])

  if (!open) return null
  return createPortal(
    <div
      className="react-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <section
        className="react-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <button
          className="react-dialog-close"
          type="button"
          aria-label="Затвори"
          onClick={onCancel}
          disabled={busy}
        >
          <X aria-hidden="true" />
        </button>
        <div className={`react-dialog-icon${danger ? " is-danger" : ""}`}>
          <AlertTriangle aria-hidden="true" />
        </div>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>
        <div className="react-dialog-actions">
          <button type="button" className="react-dialog-cancel" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <LoadingButton
            type="button"
            className={`react-dialog-confirm${danger ? " is-danger" : ""}`}
            onClick={onConfirm}
            disabled={busy}
            loading={busy}
          >
            {confirmLabel}
          </LoadingButton>
        </div>
      </section>
    </div>,
    document.body,
  )
}
