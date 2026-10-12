import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { mediaAbsoluteUrl, type MediaRecord } from "@/lib/media-api"

export type MediaQuickPreviewRecord = Pick<
  MediaRecord,
  "url" | "alt" | "title" | "original_name" | "mime"
>

export function MediaQuickPreviewDialog({
  record,
  onClose,
}: {
  record: MediaQuickPreviewRecord | null
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const titleId = useId()
  const open = record !== null && record.mime.startsWith("image/")
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  useEffect(() => {
    if (!open) return
    setLoading(true)
    const node = image.current
    if (node?.complete && node.naturalWidth > 0) setLoading(false)
  }, [open, record?.url])
  const label = record ? record.title || record.original_name : ""
  return createPortal(
    <dialog
      ref={dialog}
      className="media-picker-dialog media-quick-preview-dialog"
      aria-labelledby={titleId}
      data-workspace-transient="true"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="media-picker-heading">
        <h2 id={titleId}>{label}</h2>
        <Button type="button" variant="secondary" aria-label="Затвори" onClick={onClose}>
          <X />
        </Button>
      </div>
      {open && record && (
        <div className="media-detail-preview media-quick-preview-body">
          {loading && (
            <div
              className="media-quick-preview-skeleton admin-skeleton-shimmer"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              Зареждане…
            </div>
          )}
          <img
            ref={image}
            className={`media-quick-preview-img${loading ? " is-loading" : ""}`}
            src={mediaAbsoluteUrl(record.url)}
            alt={record.alt || label}
            decoding="async"
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
        </div>
      )}
    </dialog>,
    document.body,
  )
}
