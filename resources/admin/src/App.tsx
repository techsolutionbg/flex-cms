import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import "./index.css"

type HistoryRecord = { type?: string; id?: string; from?: string; to?: string; installed_at?: string; rolled_back_at?: string; migrations_ran?: boolean }
type SortKey = "type" | "id" | "from" | "to" | "date"
const columns: Array<{ key: SortKey; label: string }> = [
  { key: "type", label: "Тип" }, { key: "id", label: "ID" }, { key: "from", label: "От" }, { key: "to", label: "До" }, { key: "date", label: "Дата" },
]

function valueFor(record: HistoryRecord, key: SortKey): string {
  if (key === "date") return record.installed_at ?? record.rolled_back_at ?? "-"
  return record[key] ?? "-"
}

function paginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const ordered = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((left, right) => left - right)
  const items: Array<number | "ellipsis"> = []

  ordered.forEach((page, index) => {
    if (index > 0 && page - ordered[index - 1] > 1) items.push("ellipsis")
    items.push(page)
  })

  return items
}

function HistoryTable({ history, csrfToken }: { history: HistoryRecord[]; csrfToken: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [descending, setDescending] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const sortedHistory = useMemo(() => [...history].sort((left, right) => {
    const leftValue = valueFor(left, sortKey)
    const rightValue = valueFor(right, sortKey)
    const result = sortKey === "date"
      ? (Date.parse(leftValue) || 0) - (Date.parse(rightValue) || 0)
      : leftValue.localeCompare(rightValue, "bg", { numeric: true, sensitivity: "base" })
    return descending ? -result : result
  }), [descending, history, sortKey])
  const totalPages = Math.max(1, Math.ceil(sortedHistory.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = sortedHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const firstItem = sortedHistory.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, sortedHistory.length)
  function changeSort(key: SortKey) {
    if (sortKey === key) setDescending((value) => !value)
    else { setSortKey(key); setDescending(false) }
    setPage(1)
  }

  return <div className="space-y-4">
    <Table>
        <TableHeader><TableRow>
          {columns.map((column) => {
            const SortIcon = sortKey === column.key ? (descending ? ArrowDown : ArrowUp) : ArrowUpDown
            const sortLabel = sortKey === column.key ? (descending ? "низходящо" : "възходящо") : "сортиране"
            return <TableHead key={column.key} className="h-8 border border-border p-0">
              <Button type="button" variant="ghost" size="sm" className="m-0 h-7 w-full justify-start rounded-none px-2 font-medium" onClick={() => changeSort(column.key)}>{column.label}<SortIcon className="ml-1 size-3.5" aria-hidden="true" /><span className="sr-only">: {sortLabel}</span></Button>
            </TableHead>
          })}
          <TableHead className="h-8 border border-border px-2 py-1 text-right">Действия</TableHead>
        </TableRow></TableHeader>
        <TableBody>{pageRows.length === 0 ? <TableRow><TableCell colSpan={6} className="h-16 py-1 text-center text-muted-foreground">Все още няма записи.</TableCell></TableRow> : pageRows.map((record, index) => {
          const id = record.id ?? "-"; const canRollback = record.type === "platform" && record.migrations_ran !== true
          return <TableRow key={`${id}-${index}`}>
            <TableCell className="px-2 py-1">{record.type ?? "unknown"}</TableCell><TableCell className="px-2 py-1 font-mono text-xs">{id}</TableCell><TableCell className="px-2 py-1">{record.from ?? "-"}</TableCell><TableCell className="px-2 py-1">{record.to ?? "-"}</TableCell><TableCell className="px-2 py-1">{valueFor(record, "date")}</TableCell>
            <TableCell className="px-2 py-1 text-right">{canRollback ? <form method="post" action="/admin/updates/rollback"><input type="hidden" name="_token" value={csrfToken} /><input type="hidden" name="id" value={id} /><input type="hidden" name="confirm" value="1" /><Button type="submit" variant="destructive" size="sm" className="m-0">Rollback</Button></form> : <span className="text-muted-foreground">—</span>}</TableCell>
          </TableRow>
        })}</TableBody>
      </Table>
    <div className="flex items-center justify-center gap-3 text-sm whitespace-nowrap text-muted-foreground"><span>Показване {firstItem}–{lastItem} от {sortedHistory.length}</span><div className="flex items-center gap-1 rounded-md border border-border p-1">
      <Button type="button" variant="outline" size="icon-sm" className="m-0" aria-label="Предишна страница" title="Предишна страница" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
      {paginationItems(currentPage, totalPages).map((item, index) => item === "ellipsis" ? <span key={`ellipsis-${index}`} className="flex size-7 items-center justify-center" aria-hidden="true">…</span> : <Button key={item} type="button" variant={item === currentPage ? "secondary" : "outline"} size="icon-sm" className="m-0" aria-label={`Страница ${item}`} aria-current={item === currentPage ? "page" : undefined} onClick={() => setPage(item)}>{item}</Button>)}
      <Button type="button" variant="outline" size="icon-sm" className="m-0" aria-label="Следваща страница" title="Следваща страница" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight className="size-4" aria-hidden="true" /></Button>
    </div></div>
  </div>
}

export function App({ history, csrfToken }: { history: HistoryRecord[]; csrfToken: string }) {
  return <HistoryTable history={history} csrfToken={csrfToken} />
}

export default App
