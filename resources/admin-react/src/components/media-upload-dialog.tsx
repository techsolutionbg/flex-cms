import { t } from "@/lib/admin-i18n"
import { useEffect, useId, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { MediaUploader } from "./media-uploader"
import type { MediaIndex } from "@/lib/media-api"

export function MediaUploadDialog({
  open,
  onClose,
  index,
  busy,
  onBusyChange,
}: {
  open: boolean
  onClose: () => void
  index: MediaIndex | null
  busy?: boolean
  onBusyChange?: (busy: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const uploadedInSession = useRef(0)
  const titleId = useId()
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  useEffect(() => {
    if (open) uploadedInSession.current = 0
  }, [open])
  useEffect(() => {
    if (open) return
    if (uploadedInSession.current < 1) return
    uploadedInSession.current = 0
    window.dispatchEvent(new Event("flex-media-uploaded"))
  }, [open])
  const requestClose = useCallback(() => {
    if (busy) return
    onClose()
  }, [busy, onClose])
  return createPortal(
    <dialog
      ref={dialog}
      className="media-picker-dialog media-upload-dialog"
      aria-labelledby={titleId}
      data-workspace-transient="true"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) requestClose()
      }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          requestClose()
      }}
    >
      <div className="media-picker-heading">
        <h2 id={titleId}>{t("Upload files")}</h2>
        <button
          type="button"
          className="react-secondary-button"
          aria-label={t("Close")}
          disabled={busy}
          onClick={requestClose}
        >
          <X size={20} />
        </button>
      </div>
      {open &&
        (index ? (
          index.permissions.upload ? (
            <MediaUploader
              variant="dialog"
              maxBytes={index.max_bytes}
              maxImageMegapixels={index.max_image_megapixels}
              allowedTypes={index.allowed_types}
              onBusyChange={onBusyChange}
              onUploaded={() => {
                uploadedInSession.current += 1
              }}
            />
          ) : (
            <p role="alert">{t("You do not have permission to upload files.")}</p>
          )
        ) : (
          <p role="status">{t("Loading…")}</p>
        ))}
    </dialog>,
    document.body,
  )
}
