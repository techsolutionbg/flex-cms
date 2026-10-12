import { useEffect, useMemo, useRef, useState } from "react"
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
  maxImageMegapixels,
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
  variant = "inline",
}: {
  maxBytes: number
  maxImageMegapixels?: number
  onUploaded: (record: MediaRecord) => void
  imagesOnly?: boolean
  allowedTypes?: string[]
  onBusyChange?: (busy: boolean) => void
  variant?: "inline" | "dialog"
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
  function taskProgress(task: Task): number {
    if (task.status === "done" || task.status === "error") return 100
    if (task.status === "uploading") return task.progress
    return 0
  }
  const overallProgress = useMemo(() => {
    if (tasks.length === 0) return 0
    return Math.round(tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length)
  }, [tasks])
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
        if (variant !== "dialog") window.dispatchEvent(new Event("flex-media-uploaded"))
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
      className={`media-upload${variant === "dialog" ? " media-upload--dialog" : ""}${dragging && !busy ? " is-dragging" : ""}`}
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
      {maxImageMegapixels !== undefined && (
        <p>Максимална резолюция на изображенията: {maxImageMegapixels} мегапиксела.</p>
      )}
      {error && (
        <p role="alert" className="react-form-error">
          {error}
        </p>
      )}
      {tasks.length > 0 && (
        <div className="media-upload-progress-panel" aria-live="polite">
          <div
            className="media-upload-overall"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={overallProgress}
            aria-label="Общ напредък на качването"
          >
            <div className="media-upload-overall-ring-wrap">
              <svg className="media-upload-overall-ring" viewBox="0 0 44 44" aria-hidden="true">
                <circle className="media-upload-overall-track" cx="22" cy="22" r="18" />
                <circle
                  className="media-upload-overall-fill"
                  cx="22"
                  cy="22"
                  r="18"
                  pathLength={100}
                  strokeDasharray={`${overallProgress} ${100 - overallProgress}`}
                />
              </svg>
              <span className="media-upload-overall-value">{overallProgress}%</span>
            </div>
            <span className="media-upload-overall-label">
              {tasks.filter((task) => task.status === "done").length} / {tasks.length} файла
            </span>
          </div>
          <ul className="media-upload-tasks">
            {tasks.map((task) => (
              <li key={task.id}>
                <div className="media-upload-task-head">
                  <span className="media-upload-task-name">{task.name}</span>
                  <span className="media-upload-task-status">
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
                </div>
                <progress
                  className="media-upload-task-bar"
                  max={100}
                  value={taskProgress(task)}
                  aria-label={`Качване на ${task.name}`}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
      {busy && (
        <Button variant="secondary" type="button" onClick={() => controller.current?.abort()}>
          Отмени качването
        </Button>
      )}
    </section>
  )
}
