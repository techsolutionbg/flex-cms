import { LoadingButton } from "@/components/loading-button"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useMemo, useState } from "react"
import { FileImage, Info, Upload } from "lucide-react"
import { MediaUploadDialog } from "@/components/media-upload-dialog"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { MediaBrowser } from "@/components/media-browser"
import { MediaDetailSkeleton } from "@/components/media-detail-skeleton"
import { useWorkspaceChanged, useWorkspaceSaved } from "@/components/admin-workspace-context"
import {
  mediaDownloadUrl,
  mediaRequest,
  mediaSize,
  openMediaInNewWindow,
  type MediaRecord,
} from "@/lib/media-api"
import { adminUrl } from "@/lib/admin-routes"
import { Button } from "@/components/ui/button"
import type { MediaIndex } from "@/lib/media-api"
import { DateTime } from "@/components/date-time"
import { ExtensionScope, usePanelSaves } from "@/components/extension-page"

export function MediaPage({
  onLogout,
  onNavigate,
  loggingOut,
  id,
  onOpen,
  onBack,
}: {
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
  id?: number
  onOpen: (record: MediaRecord) => void
  onBack: () => void
}) {
  const [uploadIndex, setUploadIndex] = useState<MediaIndex | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [record, setRecord] = useState<MediaRecord | null>(null)
  const [usage, setUsage] = useState<{ id: number; title: string }[]>([])
  const [failure, setFailure] = useState("")
  const [busy, setBusy] = useState(false)
  // Plugins add sections and fields here through extension points; they save right after this record.
  const saves = usePanelSaves()
  const extensionScope = useMemo(
    () => ({ context: { type: "media", id: record?.id ?? null, values: record }, saves }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [record],
  )
  const [saved, setSaved] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const changed = useWorkspaceChanged(),
    markSaved = useWorkspaceSaved()
  useEffect(() => {
    const openUpload = () => setUploadOpen(true)
    window.addEventListener("flex-media-open-upload", openUpload)
    return () => window.removeEventListener("flex-media-open-upload", openUpload)
  }, [])
  useEffect(() => {
    if (id) return
    const abort = new AbortController()
    mediaRequest<MediaIndex>("/api/admin/media", "GET", undefined, abort.signal)
      .then(setUploadIndex)
      .catch((error) => {
        if (!abort.signal.aborted) setFailure(error.message)
      })
    return () => abort.abort()
  }, [id])
  useEffect(() => {
    if (!id) return
    const abort = new AbortController()
    mediaRequest<{ media: MediaRecord; usage: typeof usage; permissions: { edit: boolean } }>(
      `/api/admin/media/${id}`,
      "GET",
      undefined,
      abort.signal,
    )
      .then((data) => {
        setRecord(data.media)
        setUsage(data.usage)
        setCanEdit(data.permissions.edit)
      })
      .catch((error) => {
        if (!abort.signal.aborted) setFailure(error.message)
      })
    return () => abort.abort()
  }, [id])
  return (
    <AdminShell
      onLogout={onLogout}
      onNavigate={onNavigate}
      loggingOut={loggingOut}
      title="Медийна библиотека"
      activeItem="Медийна библиотека"
    >
      <div className="media-page-content">
        <div className="react-page-heading">
          <div>
            <h1>{id ? "Детайли на файл" : "Медийна библиотека"}</h1>
            <Breadcrumbs
              onHomeClick={() => onNavigate("Табло")}
              items={
                id
                  ? [
                      { label: "Медийна библиотека", onClick: onBack },
                      { label: record?.title ?? "Файл" },
                    ]
                  : [{ label: "Медийна библиотека" }]
              }
            />
          </div>
          {!id && uploadIndex?.permissions.upload && (
            <Button variant="secondary" type="button" onClick={() => setUploadOpen(true)}>
              <Upload size={18} /> Качи файлове
            </Button>
          )}
        </div>
        <MediaUploadDialog
          open={uploadOpen}
          busy={uploadBusy}
          index={uploadIndex}
          onBusyChange={(uploading) => {
            setUploadBusy(uploading)
            if (uploading) changed?.()
            else markSaved?.()
          }}
          onClose={() => {
            if (!uploadBusy) setUploadOpen(false)
          }}
        />
        {failure && (
          <p role="alert" className="react-form-error">
            {failure}
          </p>
        )}
        {!id ? (
          <MediaBrowser onSelect={onOpen} />
        ) : !record ? (
          !failure && <MediaDetailSkeleton />
        ) : (
          <ExtensionScope value={extensionScope}>
            <form
              className="react-page-form"
              onSubmit={async (event) => {
                event.preventDefault()
                if (busy) return
                setBusy(true)
                setFailure("")
                setSaved(false)
                try {
                  const result = await mediaRequest<{ media: MediaRecord }>(
                    `/api/admin/media/${id}`,
                    "PUT",
                    record,
                  )
                  setRecord(result.media)
                  await saves.run({ id: result.media.id })
                  markSaved?.()
                  setSaved(true)
                } catch (error) {
                  setFailure((error as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              <CollapsibleSection
                extensionPoint="media.editor.preview"
                title="Преглед"
                icon={FileImage}
              >
                <div className="media-detail-preview">
                  {record.mime.startsWith("image/") ? (
                    <img src={record.url} alt={record.alt} />
                  ) : record.mime.startsWith("video/") ? (
                    <video controls preload="metadata" src={record.url} />
                  ) : record.mime.startsWith("audio/") ? (
                    <audio controls preload="metadata" src={record.url} />
                  ) : (
                    <a href={record.url} target="_blank" rel="noopener noreferrer">
                      Отвори PDF файла
                    </a>
                  )}
                </div>
              </CollapsibleSection>
              <CollapsibleSection
                extensionPoint="media.editor.file"
                title="Информация за файла"
                icon={Info}
              >
                <div className="media-file-information">
                  <dl className="media-technical-info">
                    <dt>Оригинално име</dt>
                    <dd>{record.original_name}</dd>
                    <dt>Тип и размер</dt>
                    <dd>
                      {record.mime} · {mediaSize(record.size)}
                      {record.width ? ` · ${record.width} × ${record.height}` : ""}
                    </dd>
                    <dt>Качен на</dt>
                    <dd>
                      <DateTime value={record.created_at} />
                    </dd>
                    <dt>Качил</dt>
                    <dd>
                      {record.uploader ? (
                        <a
                          className="react-page-link"
                          href={adminUrl(`/users/${record.uploader.id}/edit`)}
                        >
                          {record.uploader.email}
                        </a>
                      ) : (
                        "Потребителят вече не е наличен."
                      )}
                    </dd>
                    <dt>Използване в страници</dt>
                    <dd>
                      {usage.length
                        ? usage.map((page) => page.title).join(", ")
                        : "Не са намерени връзки в съдържанието."}
                    </dd>
                  </dl>
                  <p className="react-field-hint">
                    Показани са известните връзки в страниците. Външни сайтове и ръчни връзки в теми
                    може също да използват файла.
                  </p>
                  <div className="react-form-actions">
                    <button
                      className="react-secondary-button"
                      type="button"
                      onClick={() => openMediaInNewWindow(record)}
                    >
                      Преглед в нов прозорец
                    </button>
                    <a className="react-secondary-button" href={mediaDownloadUrl(record.url)}>
                      Изтегли оригинала
                    </a>
                    <button
                      className="react-secondary-button"
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            new URL(record.url, location.origin).href,
                          )
                          setSaved(true)
                        } catch {
                          setFailure("Адресът не може да бъде копиран автоматично.")
                        }
                      }}
                    >
                      Копирай адреса
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection
                extensionPoint="media.editor.metadata"
                title="Метаданни"
                icon={FileImage}
              >
                <div className="react-form-grid">
                  {(["title", "alt", "caption", "description"] as const).map((field) => (
                    <div className="react-form-field" key={field}>
                      <label htmlFor={`media-${id}-${field}`}>
                        {
                          {
                            title: "Заглавие",
                            alt: "Алтернативен текст",
                            caption: "Надпис",
                            description: "Описание",
                          }[field]
                        }
                      </label>
                      {field === "caption" || field === "description" ? (
                        <Textarea
                          id={`media-${id}-${field}`}
                          value={record[field]}
                          maxLength={field === "caption" ? 2000 : 10000}
                          disabled={busy || !canEdit || !!record.deleted_at}
                          onChange={(event) => {
                            setRecord({ ...record, [field]: event.target.value })
                            changed?.()
                            setSaved(false)
                          }}
                        />
                      ) : (
                        <input
                          id={`media-${id}-${field}`}
                          value={record[field]}
                          maxLength={255}
                          disabled={busy || !canEdit || !!record.deleted_at}
                          onChange={(event) => {
                            setRecord({ ...record, [field]: event.target.value })
                            changed?.()
                            setSaved(false)
                          }}
                        />
                      )}
                      <small className="react-field-hint">
                        {
                          {
                            title: "Име за намиране на файла в библиотеката.",
                            alt: "Кратко описание на изображението за достъпност.",
                            caption: "Надпис, който може да се показва под медията.",
                            description: "Допълнителна информация за файла.",
                          }[field]
                        }
                      </small>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
              {saved && <p role="status">Готово.</p>}
              <div className="react-form-actions">
                <LoadingButton
                  loading={busy}
                  className="react-primary-button"
                  type="submit"
                  disabled={busy || !canEdit || !!record.deleted_at}
                >
                  {busy ? "Записване…" : "Запази"}
                </LoadingButton>
                <button className="react-secondary-button" type="button" onClick={onBack}>
                  Към библиотеката
                </button>
              </div>
            </form>
          </ExtensionScope>
        )}
      </div>
    </AdminShell>
  )
}
