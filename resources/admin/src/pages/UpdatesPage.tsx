import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AdminBootstrap, HistoryRecord } from "@/types"

type SortKey = "type" | "id" | "from" | "to" | "date"
const columns: Array<{ key: SortKey; label: string }> = [
  { key: "type", label: "Тип" },
  { key: "id", label: "ID" },
  { key: "from", label: "От" },
  { key: "to", label: "До" },
  { key: "date", label: "Дата" },
]
function valueFor(record: HistoryRecord, key: SortKey): string {
  return key === "date"
    ? (record.installed_at ?? record.rolled_back_at ?? "-")
    : (record[key] ?? "-")
}
function paginationItems(
  current: number,
  total: number
): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const ordered = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b)
  const items: Array<number | "ellipsis"> = []
  ordered.forEach((page, index) => {
    if (index > 0 && page - ordered[index - 1] > 1) items.push("ellipsis")
    items.push(page)
  })
  return items
}

function HistoryTable({
  history,
  csrfToken,
}: {
  history: HistoryRecord[]
  csrfToken: string
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [descending, setDescending] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const sorted = useMemo(
    () =>
      [...history].sort((left, right) => {
        const a = valueFor(left, sortKey)
        const b = valueFor(right, sortKey)
        const result =
          sortKey === "date"
            ? (Date.parse(a) || 0) - (Date.parse(b) || 0)
            : a.localeCompare(b, "bg", { numeric: true, sensitivity: "base" })
        return descending ? -result : result
      }),
    [descending, history, sortKey]
  )
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const rows = sorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  const first = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const last = Math.min(currentPage * pageSize, sorted.length)
  function changeSort(key: SortKey) {
    if (sortKey === key) setDescending((value) => !value)
    else {
      setSortKey(key)
      setDescending(false)
    }
    setPage(1)
  }
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => {
              const Icon =
                sortKey === column.key
                  ? descending
                    ? ArrowDown
                    : ArrowUp
                  : ArrowUpDown
              return (
                <TableHead
                  key={column.key}
                  className="h-8 border border-border p-0"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full justify-start rounded-none"
                    onClick={() => changeSort(column.key)}
                  >
                    {column.label}
                    <Icon aria-hidden="true" />
                  </Button>
                </TableHead>
              )
            })}
            <TableHead className="text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-16 text-center text-muted-foreground"
              >
                Все още няма записи.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((record, index) => {
              const id = record.id ?? "-"
              const canRollback =
                record.type === "platform" && record.migrations_ran !== true
              return (
                <TableRow key={`${id}-${index}`}>
                  <TableCell>{record.type ?? "unknown"}</TableCell>
                  <TableCell className="font-mono text-xs">{id}</TableCell>
                  <TableCell>{record.from ?? "-"}</TableCell>
                  <TableCell>{record.to ?? "-"}</TableCell>
                  <TableCell>{valueFor(record, "date")}</TableCell>
                  <TableCell className="text-right">
                    {canRollback ? (
                      <form method="post" action="/admin/updates/rollback">
                        <input type="hidden" name="_token" value={csrfToken} />
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="confirm" value="1" />
                        <Button type="submit" variant="destructive" size="sm">
                          Rollback
                        </Button>
                      </form>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      <div className="pagination">
        <span>
          Показване {first}–{last} от {sorted.length}
        </span>
        <div className="pagination-controls">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Предишна страница"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft />
          </Button>
          {paginationItems(currentPage, totalPages).map((item, index) =>
            item === "ellipsis" ? (
              <span key={`e-${index}`}>…</span>
            ) : (
              <Button
                key={item}
                variant={item === currentPage ? "secondary" : "outline"}
                size="icon-sm"
                aria-current={item === currentPage ? "page" : undefined}
                onClick={() => setPage(item)}
              >
                {item}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Следваща страница"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function UpdatesPage({ bootstrap }: { bootstrap: AdminBootstrap }) {
  const inspection = bootstrap.inspection
  return (
    <>
      <h1>Обновявания</h1>
      <p className="lead">
        Качете ZIP пакет за версията и стартирайте контролирано обновяване.
      </p>
      {bootstrap.notice && (
        <div className="notice success">{bootstrap.notice}</div>
      )}
      {bootstrap.error && <div className="notice error">{bootstrap.error}</div>}
      {inspection && (
        <div className="notice info">
          <strong>Пакетът е валиден.</strong>
          <br />
          Версия: {inspection.version ?? "-"} · Файлове:{" "}
          {inspection.files ?? "-"} · Миграции:{" "}
          {inspection.migrations ? "да" : "не"}
        </div>
      )}
      <section className="content-card">
        <h2>Качване на platform пакет</h2>
        <form
          method="post"
          action="/admin/updates/install"
          encType="multipart/form-data"
        >
          <input type="hidden" name="_token" value={bootstrap.csrfToken} />
          <input type="hidden" name="mode" value="install" />
          <label htmlFor="package">ZIP пакет на новата версия</label>
          <input
            id="package"
            type="file"
            name="package"
            accept="application/zip,.zip"
            required
          />
          <Button type="submit" className="mt-4">
            Актуализирай платформата
          </Button>
        </form>
        <p className="muted">
          Системата проверява checksum, цифровия подпис и съвместимостта,
          създава backup, изпълнява миграциите и прави health check.
        </p>
      </section>
      <section className="content-card">
        <h2>История</h2>
        <HistoryTable
          history={bootstrap.history ?? []}
          csrfToken={bootstrap.csrfToken}
        />
      </section>
    </>
  )
}
