import { t } from "@/lib/admin-i18n"
import { useEffect, useId, useRef, useState } from "react"
import { Button } from "./ui/button"
import { createPortal } from "react-dom"
import { Check, X } from "lucide-react"
import { MediaBrowser } from "./media-browser"
import type { MediaRecord } from "@/lib/media-api"

export function MediaPicker({
  open,
  onSelect,
  onClose,
  imagesOnly = false,
  multiple = false,
  onSelectMany,
}: {
  open: boolean
  onSelect?: (record: MediaRecord) => void
  onClose: () => void
  imagesOnly?: boolean
  multiple?: boolean
  onSelectMany?: (records: MediaRecord[]) => void
}) {
  const [selected, setSelected] = useState<MediaRecord[]>([])
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  useEffect(() => {
    setSelected([])
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
        <h2 id={title}>{t("Choose media")}</h2>
        <button
          type="button"
          className="react-secondary-button"
          aria-label={t("Close media library")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {open && (
        <MediaBrowser
          picker
          imagesOnly={imagesOnly}
          selectedIds={multiple ? new Set(selected.map((record) => record.id)) : undefined}
          onSelect={(record) => {
            if (multiple)
              setSelected((current) =>
                current.some((item) => item.id === record.id)
                  ? current.filter((item) => item.id !== record.id)
                  : [...current, record],
              )
            else {
              onSelect?.(record)
              onClose()
            }
          }}
        />
      )}
      {multiple && (
        <div className="media-picker-actions" role="group" aria-label={t("Actions for selected files")}>
          <span className="media-picker-selection-count" role="status" aria-live="polite">
            {selected.length === 1
              ? t("1 file selected")
              : t("{count} files selected", "core", { count: selected.length })}
          </span>
          <div className="media-picker-action-buttons">
            <Button type="button" variant="secondary" onClick={onClose}>

              {t("Cancel")}
            </Button>
            <Button
              type="button"
              disabled={!selected.length}
              onClick={() => {
                onSelectMany?.(selected)
                onClose()
              }}
            >
              <Check size={17} aria-hidden="true" />

              {t("Add selected (")}{selected.length})
            </Button>
          </div>
        </div>
      )}
    </dialog>,
    document.body,
  )
}
