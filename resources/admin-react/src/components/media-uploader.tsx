import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"
import { mediaSize, uploadMedia, type MediaRecord } from "@/lib/media-api"

type Task = {
  id: string
  name: string
  progress: number
  status: "waiting" | "uploading" | "done" | "error"
  error?: string
}
export function MediaUploader({
  maxBytes,
  onUploaded,
  imagesOnly = false,
  allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "video/mp4",
    "video/webm",
  ],
  onBusyChange,
}: {
  maxBytes: number
  onUploaded: (record: MediaRecord) => void
  imagesOnly?: boolean
  allowedTypes?: string[]
  onBusyChange?: (busy: boolean) => void
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const acceptedTypes = allowedTypes.filter((type) => !imagesOnly || type.startsWith("image/"))
  const acceptedLabels = [
    ...new Set(
      acceptedTypes.map(
        (type) =>
          ({
            "image/jpeg": "JPEG",
            "image/png": "PNG",
            "image/webp": "WebP",
            "image/gif": "GIF",
            "application/pdf": "PDF",
            "audio/mpeg": "MP3",
            "audio/ogg": "OGG",
            "audio/wav": "WAV",
            "audio/x-wav": "WAV",
            "video/mp4": "MP4",
            "video/webm": "WebM",
          })[type] ?? type,
      ),
    ),
  ]
  useEffect(() => () => controller.current?.abort(), [])
  function patch(id: string, values: Partial<Task>) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...values } : task)))
  }
  async function upload(files: File[]) {
    if (controller.current || files.length === 0) return
    if (files.length > 20) {
      setError("Качвайте до 20 файла наведнъж.")
      return
    }
    setError("")
    const entries = files.map((file) => ({ file, id: crypto.randomUUID() }))
    setTasks(
      entries.map(({ file, id }) => ({ id, name: file.name, progress: 0, status: "waiting" })),
    )
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    onBusyChange?.(true)
    for (const { file, id } of entries) {
      if (acceptedTypes.length === 0 || (file.type !== "" && !acceptedTypes.includes(file.type))) {
        patch(id, { status: "error", error: "Този тип файл не е разрешен от настройките." })
        continue
      }
      if (
        imagesOnly &&
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
      ) {
        patch(id, { status: "error", error: "Изберете JPEG, PNG, WebP или GIF изображение." })
        continue
      }
      if (abort.signal.aborted) {
        patch(id, { status: "error", error: "Отменено" })
        continue
      }
      if (file.size > maxBytes || file.size === 0) {
        patch(id, { status: "error", error: `Разрешеният размер е до ${mediaSize(maxBytes)}.` })
        continue
      }
      patch(id, { status: "uploading" })
      try {
        const record = await uploadMedia(file, (progress) => patch(id, { progress }), abort.signal)
        patch(id, { status: "done", progress: 100 })
        onUploaded(record)
        window.dispatchEvent(new Event("flex-media-uploaded"))
      } catch (failure) {
        patch(id, {
          status: "error",
          error: abort.signal.aborted ? "Отменено" : (failure as Error).message,
        })
      }
    }
    controller.current = null
    setBusy(false)
    onBusyChange?.(false)
    if (input.current) input.current.value = ""
  }
  return (
    <section
      className={`media-upload${dragging && !busy ? " is-dragging" : ""}`}
      aria-label="Качване на медия"
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
        event.dataTransfer.dropEffect = busy ? "none" : "copy"
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        if (!busy) void upload(Array.from(event.dataTransfer.files))
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        disabled={busy || acceptedTypes.length === 0}
        accept={acceptedTypes.join(",")}
        onChange={(event) => void upload(Array.from(event.target.files ?? []))}
        hidden
      />
      <Button
        variant="secondary"
        type="button"
        loading={busy}
        disabled={busy || acceptedTypes.length === 0}
        onClick={() => input.current?.click()}
      >
        <Upload size={18} /> Избери файлове
      </Button>
      <p>Изберете до 20 файла наведнъж или ги пуснете тук. Качването започва автоматично.</p>
      <p>
        До {mediaSize(maxBytes)} на файл. Разрешени типове:{" "}
        {acceptedLabels.length ? acceptedLabels.join(", ") : "няма"}. SVG не се поддържа.
      </p>
      {error && (
        <p role="alert" className="react-form-error">
          {error}
        </p>
      )}
      {tasks.length > 0 && (
        <ul className="media-upload-tasks" aria-live="polite">
          {tasks.map((task) => (
            <li key={task.id}>
              <span>{task.name}</span>
              <progress max={100} value={task.progress} aria-label={`Качване на ${task.name}`} />
              <span>
                {task.status === "done"
                  ? "Готово"
                  : task.status === "error"
                    ? task.error
                    : task.status === "waiting"
                      ? "Изчаква"
                      : task.progress === 100
                        ? "Обработка…"
                        : `${task.progress}%`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {busy && (
        <Button variant="secondary" type="button" onClick={() => controller.current?.abort()}>
          Отмени качването
        </Button>
      )}
    </section>
  )
}
