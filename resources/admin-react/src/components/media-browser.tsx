import { getAdminLocale, t } from "@/lib/admin-i18n"
import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Eye, File, GalleryVertical, Grid2X2, List } from "lucide-react"
import { DataTable, type DataTableColumn } from "./data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "./dropdown-menu"
import { TableActionsMenu } from "./table-actions-menu"
import { PaginationControls } from "./pagination-controls"
import { ConfirmDialog } from "./confirm-dialog"
import { MediaBrowserSkeleton } from "./media-browser-skeleton"
import { MediaQuickPreviewDialog } from "./media-quick-preview-dialog"
import { MediaUploader } from "./media-uploader"
import { Button } from "@/components/ui/button"
import {
  downloadMedia,
  mediaRequest,
  mediaSize,
  openMediaInNewWindow,
  type MediaIndex,
  type MediaRecord,
} from "@/lib/media-api"
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

type MediaLayout = "grid" | "table" | "masonry"
type MediaCardSort =
  | "created-desc"
  | "created-asc"
  | "name-asc"
  | "name-desc"
  | "size-desc"
  | "size-asc"
  | "mime-asc"
const mediaPageSize = 24

const mediaSortLabels: Record<MediaCardSort, string> = {
  "created-desc": "Дата: най-нови",
  "created-asc": "Дата: най-стари",
  "name-asc": "Име: А–Я",
  "name-desc": "Име: Я–А",
  "size-desc": "Размер: най-големи",
  "size-asc": "Размер: най-малки",
  "mime-asc": "Тип файл",
}

function formatMediaMonth(value: string): string {
  const date = new Date(`${value}-01T00:00:00`)
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(getAdminLocale(), { month: "long", year: "numeric" }).format(date)
}

function readMediaSort(): MediaCardSort {
  try {
    const stored = localStorage.getItem("flex-admin-media-sort")
    if (stored && stored in mediaSortLabels) return stored as MediaCardSort
  } catch {
    /* Optional preference. */
  }
  return "created-desc"
}

function mediaRecordName(record: MediaRecord) {
  return (record.title || record.original_name).toLocaleLowerCase("bg")
}

function compareMediaRecords(a: MediaRecord, b: MediaRecord, sort: MediaCardSort): number {
  switch (sort) {
    case "created-asc":
      return (parse(a.created_at)?.valueOf() ?? 0) - (parse(b.created_at)?.valueOf() ?? 0)
    case "name-asc":
      return mediaRecordName(a).localeCompare(mediaRecordName(b), "bg")
    case "name-desc":
      return mediaRecordName(b).localeCompare(mediaRecordName(a), "bg")
    case "size-desc":
      return b.size - a.size
    case "size-asc":
      return a.size - b.size
    case "mime-asc":
      return a.mime.localeCompare(b.mime, "bg") || a.id - b.id
    case "created-desc":
    default:
      return (parse(b.created_at)?.valueOf() ?? 0) - (parse(a.created_at)?.valueOf() ?? 0)
  }
}

function readMediaLayout(): MediaLayout {
  try {
    const stored = localStorage.getItem("flex-admin-media-view")
    if (stored === "table" || stored === "grid" || stored === "masonry") return stored
  } catch {
    /* Optional preference. */
  }
  return "masonry"
}

function readMasonryInfiniteScroll(): boolean {
  try {
    return localStorage.getItem("flex-admin-media-masonry-scroll") === "infinite"
  } catch {
    return false
  }
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
  const [layout, setLayout] = useState<MediaLayout>(readMediaLayout)
  const [cardSort, setCardSort] = useState<MediaCardSort>(readMediaSort)
  const [masonryInfiniteScroll, setMasonryInfiniteScroll] = useState(readMasonryInfiniteScroll)
  const [visibleCount, setVisibleCount] = useState(mediaPageSize)
  const masonrySentinelRef = useRef<HTMLDivElement>(null)
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
  const [quickPreview, setQuickPreview] = useState<MediaRecord | null>(null)
  useEffect(() => {
    const refresh = () => {
      setPage(1)
      setVisibleCount(mediaPageSize)
      setRevision((current) => current + 1)
    }
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
  useEffect(() => {
    try {
      localStorage.setItem("flex-admin-media-sort", cardSort)
    } catch {
      /* Optional preference. */
    }
  }, [cardSort])
  useEffect(() => {
    try {
      localStorage.setItem(
        "flex-admin-media-masonry-scroll",
        masonryInfiniteScroll ? "infinite" : "pages",
      )
    } catch {
      /* Optional preference. */
    }
  }, [masonryInfiniteScroll])
  const filtered = useMemo(
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
  const data = useMemo(() => {
    if (layout === "table") return filtered
    const sorted = [...filtered]
    sorted.sort((a, b) => compareMediaRecords(a, b, cardSort))
    return sorted
  }, [filtered, layout, cardSort])
  useEffect(() => {
    setPage(1)
    setVisibleCount(mediaPageSize)
  }, [search, type, month, view, cardSort])
  const months = [...new Set((index?.media ?? []).map((record) => record.created_at.slice(0, 7)))]
    .sort()
    .reverse()
  const masonryInfiniteActive = layout === "masonry" && masonryInfiniteScroll
  const totalPages = Math.max(1, Math.ceil(data.length / mediaPageSize)),
    activePage = Math.min(page, totalPages)
  const cardRecords = masonryInfiniteActive
    ? data.slice(0, visibleCount)
    : data.slice((activePage - 1) * mediaPageSize, activePage * mediaPageSize)
  useEffect(() => {
    if (!masonryInfiniteActive || loading) return
    const node = masonrySentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        setVisibleCount((current) =>
          current >= data.length ? current : Math.min(current + mediaPageSize, data.length),
        )
      },
      { rootMargin: "320px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [masonryInfiniteActive, loading, data.length, cardRecords.length])
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
  function fileActions(record: MediaRecord) {
    return (
      <>
        {record.mime.startsWith("image/") && (
          <DropdownOption onClick={() => setQuickPreview(record)}>{t("Quick preview")}</DropdownOption>
        )}
        <DropdownOption onClick={() => openMediaInNewWindow(record)}>

          {t("Open in a new window")}
        </DropdownOption>
        <DropdownOption onClick={() => downloadMedia(record)}>{t("Download")}</DropdownOption>
      </>
    )
  }
  function quickPreviewButton(record: MediaRecord) {
    if (!record.mime.startsWith("image/")) return null
    return (
      <Button
        type="button"
        variant="secondary"
        className="media-card-quick-preview"
        aria-label={`Бърз преглед: ${record.title || record.original_name}`}
        title={t("Quick preview")}
        onClick={() => setQuickPreview(record)}
      >
        <Eye size={16} aria-hidden="true" />
      </Button>
    )
  }
  function actions(record: MediaRecord) {
    return (
      <TableActionsMenu>
        {view === "active" ? (
          <>
            <DropdownOption onClick={() => onSelect(record)}>
              {picker ? t("Select") : t("Preview and edit")}
            </DropdownOption>
            {fileActions(record)}
            {!picker && index?.permissions.delete && (
              <DropdownOption
                disabled={busy}
                onClick={() => setDeleting({ record, operation: "trash" })}
              >

                {t("Move item to trash")}
              </DropdownOption>
            )}
          </>
        ) : (
          <>
            {fileActions(record)}
            <DropdownOption disabled={busy} onClick={() => void action(record, "restore")}>

              {t("Restore")}
            </DropdownOption>
            <DropdownOption
              disabled={busy}
              onClick={() => setDeleting({ record, operation: "force" })}
            >

              {t("Delete forever")}
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
            ariaLabel={t("Media type")}
            trigger={
              <>
                {t(types[type])} <DropdownChevron />
              </>
            }
          >
            {Object.entries(types).map(([value, label]) => (
              <DropdownOption key={value} selected={value === type} onClick={() => setType(value)}>
                {t(label)}
              </DropdownOption>
            ))}
          </DropdownMenu>
        )}
        <DropdownMenu
          triggerVariant="secondary"
          ariaLabel={t("Upload month")}
          trigger={
            <>
                {month === "all" ? t("All dates") : formatMediaMonth(month)} <DropdownChevron />
            </>
          }
        >
          {["all", ...months].map((value) => (
            <DropdownOption key={value} selected={value === month} onClick={() => setMonth(value)}>
              {value === "all" ? t("All dates") : formatMediaMonth(value)}
            </DropdownOption>
          ))}
        </DropdownMenu>
        {(layout === "grid" || layout === "masonry") && (
          <DropdownMenu
            triggerVariant="secondary"
            ariaLabel={t("Sort media")}
            trigger={
              <>
                {t(mediaSortLabels[cardSort])} <DropdownChevron />
              </>
            }
          >
            {(Object.keys(mediaSortLabels) as MediaCardSort[]).map((value) => (
              <DropdownOption
                key={value}
                selected={value === cardSort}
                onClick={() => setCardSort(value)}
              >
                {t(mediaSortLabels[value])}
              </DropdownOption>
            ))}
          </DropdownMenu>
        )}
        {!picker && (
          <DropdownMenu
            triggerVariant="secondary"
            ariaLabel={t("Media view")}
            trigger={
              <>
                {view === "active" ? t("Media library") : t("Trash")} <DropdownChevron />
              </>
            }
          >
            {["active", "trash"].map((value) => (
              <DropdownOption key={value} selected={view === value} onClick={() => setView(value)}>
                {value === "active" ? t("Media library") : t("Trash")}
              </DropdownOption>
            ))}
          </DropdownMenu>
        )}
        {layout === "masonry" && (
          <DropdownMenu
            triggerVariant="secondary"
            ariaLabel={t("Masonry scrolling")}
            trigger={
              <>
                {masonryInfiniteScroll ? t("Infinite scroll") : t("Pagination")}{" "}
                <DropdownChevron />
              </>
            }
          >
            <DropdownOption
              selected={!masonryInfiniteScroll}
              onClick={() => {
                setMasonryInfiniteScroll(false)
                setPage(1)
                setVisibleCount(mediaPageSize)
              }}
            >

              {t("Pagination")}
            </DropdownOption>
            <DropdownOption
              selected={masonryInfiniteScroll}
              onClick={() => {
                setMasonryInfiniteScroll(true)
                setVisibleCount(mediaPageSize)
              }}
            >

              {t("Infinite scroll")}
            </DropdownOption>
          </DropdownMenu>
        )}
        <div className="media-view-controls">
          <Button
            variant="secondary"
            type="button"
            aria-label={t("Grid")}
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >
            <Grid2X2 size={18} />
          </Button>
          <Button
            variant="secondary"
            type="button"
            aria-label={t("Table")}
            aria-pressed={layout === "table"}
            onClick={() => setLayout("table")}
          >
            <List size={18} />
          </Button>
          <Button
            variant="secondary"
            type="button"
            aria-label="Masonry"
            aria-pressed={layout === "masonry"}
            onClick={() => setLayout("masonry")}
          >
            <GalleryVertical size={18} />
          </Button>
        </div>
      </div>
      <div className="react-form-field">
        <label htmlFor={picker ? "picker-media-search" : "media-search"}>{t("Search")}</label>
        <input
          id={picker ? "picker-media-search" : "media-search"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("Name, title, or alt text…")}
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
  function renderCard(record: MediaRecord) {
    const label = record.title || record.original_name
    return (
      <article
        className={`media-card${layout === "masonry" ? " media-card--masonry" : ""}${selectedIds?.has(record.id) ? " is-selected" : ""}`}
        key={record.id}
      >
        <button
          type="button"
          className="media-card-preview"
          aria-pressed={selectedIds ? selectedIds.has(record.id) : undefined}
          aria-label={
            selectedIds
              ? `${selectedIds.has(record.id) ? t("Remove from selected") : t("Select")}: ${label}`
              : `${t("Select")}: ${label}`
          }
          onClick={() => onSelect(record)}
        >
          <span className="media-card-image-wrap">
            <MediaPreview record={record} />
            {layout === "masonry" && (
              <span className="media-card-hover-meta">
                <strong>{label}</strong>
                <span>{mediaSize(record.size)}</span>
              </span>
            )}
            {selectedIds && (
              <span
                className={`media-selection-badge${selectedIds.has(record.id) ? " is-selected" : ""}`}
              >
                {selectedIds.has(record.id) && <Check size={14} aria-hidden="true" />}
                {selectedIds.has(record.id) ? t("Selected item") : t("Select")}
              </span>
            )}
          </span>
          {layout !== "masonry" && <span className="media-card-title">{label}</span>}
        </button>
        {layout === "masonry" ? (
          <div
            className="media-card-corner-actions"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {quickPreviewButton(record)}
            {actions(record)}
          </div>
        ) : (
          <div className="media-card-footer">
            <span>{mediaSize(record.size)}</span>
            <span className="media-card-tool-actions">
              {quickPreviewButton(record)}
              {actions(record)}
            </span>
          </div>
        )}
      </article>
    )
  }
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
          extensionPoint="media.list"
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
            <MediaBrowserSkeleton layout={layout === "masonry" ? "masonry" : "grid"} />
          ) : (
            <>
              <div className={layout === "masonry" ? "media-masonry" : "media-grid"}>
                {cardRecords.map((record) => renderCard(record))}
              </div>
              {masonryInfiniteActive && cardRecords.length < data.length && (
                <div
                  ref={masonrySentinelRef}
                  className="media-masonry-sentinel"
                  aria-hidden="true"
                />
              )}
              {data.length === 0 && <p>{t("No files found.")}</p>}
              <div className="react-pagination">
                <span>
                  {masonryInfiniteActive
                    ? `Показани ${cardRecords.length} от ${data.length}`
                    : `Показани ${data.length === 0 ? 0 : (activePage - 1) * mediaPageSize + 1}–${Math.min(activePage * mediaPageSize, data.length)} от ${data.length}`}
                </span>
                {!masonryInfiniteActive && (
                  <PaginationControls
                    page={activePage}
                    totalPages={totalPages}
                    onChange={setPage}
                    loading={busy}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
      <MediaQuickPreviewDialog record={quickPreview} onClose={() => setQuickPreview(null)} />
      <ConfirmDialog
        open={!!deleting}
        title={deleting?.operation === "trash" ? t("Move to trash") : t("Delete file")}
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
