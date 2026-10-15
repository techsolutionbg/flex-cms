import { t } from "@/lib/admin-i18n"
import { Image as ImageIcon, X } from "lucide-react"
import { useEffect, useId, useState, type CSSProperties } from "react"
import { mediaRequest, type MediaRecord } from "@/lib/media-api"
import { MediaPicker } from "./media-picker"

const BACKGROUNDS = {
  light: "#fff",
  dark: "#0f172a",
  surface: "var(--control-bg, var(--surface-subtle, transparent))",
} as const

export type ImageFieldBackground = keyof typeof BACKGROUNDS | (string & {})

export type ImageFieldProps = {
  /** Visible name of the field. */
  label: string
  /** Media library id, or null when nothing is chosen. */
  value: number | null
  onChange: (id: number | null) => void
  description?: string
  /** Optional theme-provided preview shown until a media-library image is selected. */
  previewUrl?: string | null
  disabled?: boolean
  /**
   * Surface behind the image. The default follows the panel theme.
   * `light` and `dark` preview artwork on a fixed background (a logo).
   * Any other CSS color is used as-is.
   */
  background?: ImageFieldBackground
  /** CSS aspect-ratio of the tile. */
  aspectRatio?: string
  /** How the image fills the tile. */
  fit?: "contain" | "cover"
  /** Maximum width of the tile. */
  width?: string
  /** Corner radius of the tile. */
  radius?: string
  emptyLabel?: string
  missingLabel?: string
  changeLabel?: string
  removeLabel?: string
}

function chosenId(value: number | null): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null
}

export function ImageField({
  label,
  value,
  onChange,
  description,
  previewUrl,
  disabled = false,
  background = "surface",
  aspectRatio = "16 / 10",
  fit = "contain",
  width = "16rem",
  radius = "0.75rem",
  emptyLabel = "Избери изображение",
  missingLabel = "Изображението липсва — избери друго",
  changeLabel = "Смени",
  removeLabel = "Премахни",
}: ImageFieldProps) {
  const descriptionId = useId()
  const id = chosenId(value)
  const [open, setOpen] = useState(false)
  const [record, setRecord] = useState<MediaRecord | null>(null)
  const [missing, setMissing] = useState(false)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const preset = background in BACKGROUNDS ? (background as keyof typeof BACKGROUNDS) : null
  const backgroundColor = preset ? BACKGROUNDS[preset] : background
  const preview = id === null
    ? (previewUrl || null)
    : record && record.id === id ? record.thumbnail_url || record.url : null
  const loading = id !== null && record?.id !== id && !missing
  const imageReady = preview !== null && loadedSrc === preview
  const showSkeleton = id !== null && (loading || (preview !== null && !imageReady))

  useEffect(() => {
    if (id === null) {
      setRecord(null)
      setMissing(false)
      return
    }
    const abort = new AbortController()
    setMissing(false)
    mediaRequest<{ media?: MediaRecord }>(`/api/admin/media/${id}`, "GET", undefined, abort.signal)
      .then((body) => {
        if (abort.signal.aborted) return
        if (body.media && body.media.id === id) setRecord(body.media)
        else {
          setRecord(null)
          setMissing(true)
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setRecord(null)
          setMissing(true)
        }
      })
    return () => abort.abort()
  }, [id])

  const style = {
    "--image-field-background": backgroundColor,
    "--image-field-foreground": preset === "dark" ? "#e2e8f0" : "var(--text-secondary, inherit)",
    "--image-field-border": preset === "dark" ? "#334155" : "var(--control-border, var(--border))",
    "--image-field-aspect": aspectRatio,
    "--image-field-fit": fit,
    "--image-field-width": width,
    "--image-field-radius": radius,
  } as CSSProperties

  return (
    <div
      className={`react-form-field image-field${preset === "dark" ? " is-dark" : ""}${fit === "cover" ? " is-cover" : ""}`}
      style={style}
    >
      <span>{t(label)}</span>
      <div className="image-field-frame">
        <button
          type="button"
          className={`image-field-tile${preview && !missing ? " has-image" : ""}`}
          disabled={disabled}
            aria-label={id === null && !previewUrl ? `${t(label)}: ${t(emptyLabel)}` : `${t(label)}: ${t(changeLabel)}`}
          aria-describedby={description ? descriptionId : undefined}
          aria-busy={showSkeleton || undefined}
          onClick={() => setOpen(true)}
        >
          {showSkeleton && (
            <span className="image-field-skeleton admin-skeleton-shimmer">
              <span className="media-skeleton-status">{t("Loading image…")}</span>
            </span>
          )}
          {preview && (
            <img
              className="image-field-image"
              src={preview}
              alt={record?.alt || record?.title || ""}
              style={{ opacity: imageReady ? 1 : 0 }}
              onLoad={() => setLoadedSrc(preview)}
              onError={() => setLoadedSrc(preview)}
            />
          )}
          {((id === null && !previewUrl) || missing) && (
            <span className="image-field-empty" aria-hidden="true">
              <ImageIcon />
              <span>{t(missing ? missingLabel : emptyLabel)}</span>
            </span>
          )}
          {preview && !missing && !showSkeleton && (
            <span className="image-field-hover" aria-hidden="true">
              {t(changeLabel)}
            </span>
          )}
        </button>
        {id !== null && (
          <button
            type="button"
            className="image-field-remove"
            disabled={disabled}
            aria-label={`${t(label)}: ${t(removeLabel)}`}
            title={t(removeLabel)}
            onClick={() => onChange(null)}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      {description && (
        <small id={descriptionId} className="react-field-hint">
          {t(description)}
        </small>
      )}
      <MediaPicker
        open={open}
        imagesOnly
        onClose={() => setOpen(false)}
        onSelect={(selected) => {
          setRecord(selected)
          setMissing(false)
          setLoadedSrc(null)
          onChange(selected.id)
          setOpen(false)
        }}
      />
    </div>
  )
}
