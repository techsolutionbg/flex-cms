import { useEffect, useMemo, useState } from "react"
import { Check, File, Grid2X2, List } from "lucide-react"
import { DataTable, type DataTableColumn } from "./data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "./dropdown-menu"
import { TableActionsMenu } from "./table-actions-menu"
import { PaginationControls } from "./pagination-controls"
import { ConfirmDialog } from "./confirm-dialog"
import { MediaUploader } from "./media-uploader"
import { Button } from "@/components/ui/button"
import { mediaRequest, mediaSize, type MediaIndex, type MediaRecord } from "@/lib/media-api"
import { DateTime } from "@/components/date-time"
import { parse } from "@/lib/flex-time"

export function MediaPreview({ record }: { record: MediaRecord }) {
  return record.mime.startsWith("image/") && record.thumbnail_url ? (
    <img
      src={record.thumbnail_url}
      decoding="async"
      alt={record.alt || record.title}
      loading="lazy"
    />
  ) : (
    <File size={42} aria-hidden="true" />
  )
}

export function MediaBrowser({
  onSelect,
  picker = false,
  imagesOnly = false,
  selectedIds,
}: {
  onSelect: (record: MediaRecord) => void
  picker?: boolean
  imagesOnly?: boolean
  selectedIds?: ReadonlySet<number>
}) {
  const [index, setIndex] = useState<MediaIndex | null>(null)
  const [view, setView] = useState("active")
  const [layout, setLayout] = useState<"grid" | "table">(() => {
    try {
      return localStorage.getItem("flex-admin-media-view") === "table" ? "table" : "grid"
    } catch {
      return "grid"
    }
  })
  const [search, setSearch] = useState("")
  const [type, setType] = useState("all")
  const [month, setMonth] = useState("all")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState("")
  const [deleting, setDeleting] = useState<{
    record: MediaRecord
    operation: "trash" | "force"
  } | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1)
    window.addEventListener("flex-media-uploaded", refresh)
    return () => window.removeEventListener("flex-media-uploaded", refresh)
  }, [])
  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    setFailure("")
    setIndex(null)
    mediaRequest<MediaIndex>(`/api/admin/media?view=${view}`, "GET", undefined, abort.signal)
      .then(setIndex)
      .catch((error) => {
        if (!abort.signal.aborted) setFailure(error.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [view, revision])
  useEffect(() => {
    try {
      localStorage.setItem("flex-admin-media-view", layout)
    } catch {
      /* Optional preference. */
    }
  }, [layout])
  const data = useMemo(
    () =>
      (index?.media ?? []).filter(
        (record) =>
          (!imagesOnly || record.mime.startsWith("image/")) &&
          (type === "all" || record.mime.startsWith(type)) &&
          (month === "all" || record.created_at.startsWith(month)) &&
          `${record.title} ${record.original_name} ${record.alt}`
            .toLocaleLowerCase("bg")
            .includes(search.toLocaleLowerCase("bg").trim()),
      ),
    [index, type, month, search, imagesOnly],
  )
  useEffect(() => setPage(1), [search, type, month, view])
  const months = [...new Set((index?.media ?? []).map((record) => record.created_at.slice(0, 7)))]
    .sort()
    .reverse()
  const totalPages = Math.max(1, Math.ceil(data.length / 24)),
    activePage = Math.min(page, totalPages)
  async function action(record: MediaRecord, operation: "trash" | "restore" | "force") {
    if (busy) return
    setBusy(true)
    setFailure("")
    try {
      await mediaRequest(
        `/api/admin/media/${record.id}${operation === "trash" ? "" : `/${operation}`}`,
        operation === "restore" ? "POST" : "DELETE",
        {},
      )
      setIndex((current) =>
        current
          ? { ...current, media: current.media.filter((item) => item.id !== record.id) }
          : current,
      )
      setDeleting(null)
    } catch (error) {
      setFailure((error as Error).message)
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }
  function actions(record: MediaRecord) {
    return (
      <TableActionsMenu>
        {view === "active" ? (
          <>
            <DropdownOption onClick={() => onSelect(record)}>
              {picker ? "Избери" : "Преглед и редакция"}
            </DropdownOption>
            {!picker && index?.permissions.delete && (
              <DropdownOption
                disabled={busy}
                onClick={() => setDeleting({ record, operation: "trash" })}
              >
                Премести в кошчето
              </DropdownOption>
            )}
          </>
        ) : (
          <>
            <DropdownOption disabled={busy} onClick={() => void action(record, "restore")}>
              Възстанови
            </DropdownOption>
            <DropdownOption
              disabled={busy}
              onClick={() => setDeleting({ record, operation: "force" })}
            >
              Изтрий завинаги
            </DropdownOption>
          </>
        )}
      </TableActionsMenu>
    )
  }
  const types: Record<string, string> = {
    all: "Всички типове",
    "image/": "Изображения",
    "application/pdf": "PDF",
    "audio/": "Аудио",
    "video/": "Видео",
  }
  const filters = (
    <div className="media-filters">
      <div className="media-filter-controls">
        {!imagesOnly && (
          <DropdownMenu
            triggerVariant="secondary"
            ariaLabel="Тип медия"
            trigger={
              <>
                {types[type]} <DropdownChevron />
              </>
            }
          >
            {Object.entries(types).map(([value, label]) => (
              <DropdownOption key={value} selected={value === type} onClick={() => setType(value)}>
                {label}
              </DropdownOption>
            ))}
          </DropdownMenu>
        )}
        <DropdownMenu
          triggerVariant="secondary"
          ariaLabel="Месец на качване"
          trigger={
            <>
              {month === "all" ? "Всички дати" : month} <DropdownChevron />
            </>
          }
        >
          {["all", ...months].map((value) => (
            <DropdownOption key={value} selected={value === month} onClick={() => setMonth(value)}>
              {value === "all" ? "Всички дати" : value}
            </DropdownOption>
          ))}
        </DropdownMenu>
        {!picker && (
          <DropdownMenu
            triggerVariant="secondary"
            ariaLabel="Изглед на медията"
            trigger={
              <>
                {view === "active" ? "Медийна библиотека" : "Кошче"} <DropdownChevron />
              </>
            }
          >
            {["active", "trash"].map((value) => (
              <DropdownOption key={value} selected={view === value} onClick={() => setView(value)}>
                {value === "active" ? "Медийна библиотека" : "Кошче"}
              </DropdownOption>
            ))}
          </DropdownMenu>
        )}
        <div className="media-view-controls">
          <Button
            variant="secondary"
            type="button"
            aria-label="Решетка"
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >
            <Grid2X2 size={18} />
          </Button>
          <Button
            variant="secondary"
            type="button"
            aria-label="Таблица"
            aria-pressed={layout === "table"}
            onClick={() => setLayout("table")}
          >
            <List size={18} />
          </Button>
        </div>
      </div>
      <div className="react-form-field">
        <label htmlFor={picker ? "picker-media-search" : "media-search"}>Търсене</label>
        <input
          id={picker ? "picker-media-search" : "media-search"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Име, заглавие или alt текст…"
        />
      </div>
    </div>
  )
  const columns: DataTableColumn<MediaRecord>[] = [
    {
      key: "title",
      label: "Файл",
      sortable: true,
      render: (record) => (
        <button type="button" className="react-table-link" onClick={() => onSelect(record)}>
          {record.title || record.original_name}
        </button>
      ),
    },
    { key: "mime", label: "Тип", sortable: true },
    { key: "size", label: "Размер", sortable: true, render: (record) => mediaSize(record.size) },
    {
      key: "created_at",
      label: "Качен на",
      sortable: true,
      render: (record) => <DateTime value={record.created_at} style="date" />,
      sortValue: (record) => parse(record.created_at)?.valueOf() ?? 0,
    },
    { key: "actions", label: "Действия", render: actions },
  ]
  return (
    <div className="media-browser">
      {picker && view === "active" && index?.permissions.upload && (
        <MediaUploader
          maxBytes={index.max_bytes}
          maxImageMegapixels={index.max_image_megapixels}
          allowedTypes={index.allowed_types}
          imagesOnly={imagesOnly}
          onUploaded={(record) =>
            setIndex((current) =>
              current ? { ...current, media: [record, ...current.media] } : current,
            )
          }
        />
      )}
      {failure && (
        <p className="react-form-error" role="alert">
          {failure}
        </p>
      )}
      {layout === "table" ? (
        <DataTable
          data={data}
          columns={columns}
          rowKey={(record) => record.id}
          loading={loading}
          selectable={!!selectedIds}
          selectedKeys={selectedIds}
          onSelectionChange={
            selectedIds
              ? (keys) => {
                  for (const record of data)
                    if (keys.has(record.id) !== selectedIds.has(record.id)) onSelect(record)
                }
              : undefined
          }
          toolbar={filters}
          filterStorageKey={picker ? "media-picker" : "media"}
        />
      ) : (
        <>
          {filters}
          {loading ? (
            <p role="status">Зареждане…</p>
          ) : (
            <>
              <div className="media-grid">
                {data.slice((activePage - 1) * 24, activePage * 24).map((record) => (
                  <article
                    className={`media-card${selectedIds?.has(record.id) ? " is-selected" : ""}`}
                    key={record.id}
                  >
                    <button
                      type="button"
                      className="media-card-preview"
                      aria-pressed={selectedIds ? selectedIds.has(record.id) : undefined}
                      aria-label={
                        selectedIds
                          ? `${selectedIds.has(record.id) ? "Премахни от избраните" : "Избери"}: ${record.title || record.original_name}`
                          : `Избери: ${record.title || record.original_name}`
                      }
                      onClick={() => onSelect(record)}
                    >
                      <span className="media-card-image-wrap">
                        <MediaPreview record={record} />
                        {selectedIds && (
                          <span
                            className={`media-selection-badge${selectedIds.has(record.id) ? " is-selected" : ""}`}
                          >
                            {selectedIds.has(record.id) && <Check size={14} aria-hidden="true" />}
                            {selectedIds.has(record.id) ? "Избрано" : "Избери"}
                          </span>
                        )}
                      </span>
                      <span className="media-card-title">
                        {record.title || record.original_name}
                      </span>
                    </button>
                    <div className="media-card-footer">
                      <span>{mediaSize(record.size)}</span>
                      {actions(record)}
                    </div>
                  </article>
                ))}
              </div>
              {data.length === 0 && <p>Няма намерени файлове.</p>}
              <div className="react-pagination">
                <span>
                  Показани {data.length === 0 ? 0 : (activePage - 1) * 24 + 1}–
                  {Math.min(activePage * 24, data.length)} от {data.length}
                </span>
                <PaginationControls
                  page={activePage}
                  totalPages={totalPages}
                  onChange={setPage}
                  loading={busy}
                />
              </div>
            </>
          )}
        </>
      )}
      <ConfirmDialog
        open={!!deleting}
        title={deleting?.operation === "trash" ? "Преместване в кошчето" : "Изтриване на файл"}
        message={
          deleting?.operation === "trash"
            ? `Да преместим ли „${deleting.record.title || deleting.record.original_name}“ в кошчето? Файлът може да бъде възстановен по-късно.`
            : `Да изтрием ли окончателно „${deleting?.record.title || deleting?.record.original_name}“? Файлът и миниатюрата ще бъдат премахнати. Използваните в страници файлове са защитени.`
        }
        busy={busy}
        confirmLabel={deleting?.operation === "trash" ? "Премести в кошчето" : "Изтрий завинаги"}
        danger={deleting?.operation === "force"}
        onCancel={() => {
          if (!busy) setDeleting(null)
        }}
        onConfirm={() => {
          if (deleting) void action(deleting.record, deleting.operation)
        }}
      />
    </div>
  )
}
