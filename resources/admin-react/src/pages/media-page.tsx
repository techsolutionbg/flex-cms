import { t } from "@/lib/admin-i18n"
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
      title={t("Media library")}
      activeItem="Медийна библиотека"
    >
      <div className="media-page-content">
        <div className="react-page-heading">
          <div>
            <h1>{id ? t("File details") : t("Media library")}</h1>
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
              <Upload size={18} />  {t("Choose files to upload")}
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
                title={t("Preview")}
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

                      {t("Open PDF file")}
                    </a>
                  )}
                </div>
              </CollapsibleSection>
              <CollapsibleSection
                extensionPoint="media.editor.file"
                title={t("File information")}
                icon={Info}
              >
                <div className="media-file-information">
                  <dl className="media-technical-info">
                    <dt>{t("Original name")}</dt>
                    <dd>{record.original_name}</dd>
                    <dt>{t("Type and size")}</dt>
                    <dd>
                      {record.mime} · {mediaSize(record.size)}
                      {record.width ? ` · ${record.width} × ${record.height}` : ""}
                    </dd>
                    <dt>{t("Uploaded on")}</dt>
                    <dd>
                      <DateTime value={record.created_at} />
                    </dd>
                    <dt>{t("Uploaded by")}</dt>
                    <dd>
                      {record.uploader ? (
                        <a
                          className="react-page-link"
                          href={adminUrl(`/users/${record.uploader.id}/edit`)}
                        >
                          {record.uploader.email}
                        </a>
                      ) : (
                        t("The user is no longer available.")
                      )}
                    </dd>
                    <dt>{t("Usage on pages")}</dt>
                    <dd>
                      {usage.length
                        ? usage.map((page) => page.title).join(", ")
                        : t("No references were found in the content.")}
                    </dd>
                  </dl>
                  <p className="react-field-hint">

                    {t("Known page references are shown here. External sites and manual links in themes may also use this file.")}
                  </p>
                  <div className="react-form-actions">
                    <button
                      className="react-secondary-button"
                      type="button"
                      onClick={() => openMediaInNewWindow(record)}
                    >

                      {t("Open in a new window")}
                    </button>
                    <a className="react-secondary-button" href={mediaDownloadUrl(record.url)}>

                      {t("Download original")}
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
                          setFailure(t("The address could not be copied automatically."))
                        }
                      }}
                    >

                      {t("Copy address")}
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection
                extensionPoint="media.editor.metadata"
                title={t("Metadata")}
                icon={FileImage}
              >
                <div className="react-form-grid">
                  {(["title", "alt", "caption", "description"] as const).map((field) => (
                    <div className="react-form-field" key={field}>
                      <label htmlFor={`media-${id}-${field}`}>
                        {
                          {
                            title: t("Title"),
                            alt: t("Alternative text"),
                            caption: t("Caption"),
                            description: t("Description"),
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
                            alt: t("Brief description of the image for accessibility."),
                            caption: t("Caption that can be displayed below the media."),
                            description: "Допълнителна информация за файла.",
                          }[field]
                        }
                      </small>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
              {saved && <p role="status">{t("Done.")}</p>}
              <div className="react-form-actions">
                <LoadingButton
                  loading={busy}
                  className="react-primary-button"
                  type="submit"
                  disabled={busy || !canEdit || !!record.deleted_at}
                >
                  {busy ? t("Saving record…") : t("Save")}
                </LoadingButton>
                <button className="react-secondary-button" type="button" onClick={onBack}>

                  {t("Back to library")}
                </button>
              </div>
            </form>
          </ExtensionScope>
        )}
      </div>
    </AdminShell>
  )
}
