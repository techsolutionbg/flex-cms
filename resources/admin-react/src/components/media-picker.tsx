import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { MediaBrowser } from "./media-browser"
import type { MediaRecord } from "@/lib/media-api"

export function MediaPicker({
  open,
  onSelect,
  onClose,
  imagesOnly = false,
}: {
  open: boolean
  onSelect: (record: MediaRecord) => void
  onClose: () => void
  imagesOnly?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  return createPortal(
    <dialog
      ref={dialog}
      className="media-picker-dialog"
      data-workspace-transient="true"
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose()
        }
      }}
    >
      <div className="media-picker-heading">
        <h2 id={title}>Избери медия</h2>
        <button
          type="button"
          className="react-secondary-button"
          aria-label="Затвори библиотеката"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {open && (
        <MediaBrowser
          picker
          imagesOnly={imagesOnly}
          onSelect={(record) => {
            onSelect(record)
            onClose()
          }}
        />
      )}
    </dialog>,
    document.body,
  )
}
