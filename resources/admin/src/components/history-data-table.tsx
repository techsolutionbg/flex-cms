import { useMemo } from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { HistoryRecord } from "@/types"

const PAGE_SIZE = 10
type HistoryTableRow = HistoryRecord & { search: string }

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

const columnHelper = createColumnHelper<typeof features, HistoryTableRow>()

function formatDate(value: string | undefined): string {
  if (!value) return "—"

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return value

  return new Intl.DateTimeFormat("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp)
}

function typeLabel(type: string | undefined): string {
  return type === "platform" ? "Платформа" : (type ?? "Неизвестен")
}

function paginationItems(
  current: number,
  total: number
): Array<number | "ellipsis"> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index)

  const pages = [...new Set([0, total - 1, current - 1, current, current + 1])]
    .filter((page) => page >= 0 && page < total)
    .sort((left, right) => left - right)
  const items: Array<number | "ellipsis"> = []

  pages.forEach((page, index) => {
    if (index > 0 && page - pages[index - 1] > 1) items.push("ellipsis")
    items.push(page)
  })

  return items
}

function RollbackForm({
  csrfToken,
  record,
}: {
  csrfToken: string
  record: HistoryRecord
}) {
  if (record.type !== "platform" || record.migrations_ran === true) return "—"

  return (
    <form method="post" action="/admin/updates/rollback">
      <input type="hidden" name="_token" value={csrfToken} />
      <input type="hidden" name="id" value={record.id ?? ""} />
      <input type="hidden" name="confirm" value="1" />
      <Button type="submit" variant="destructive" size="sm">
        Връщане
      </Button>
    </form>
  )
}

export function HistoryDataTable({
  history,
  csrfToken,
}: {
  history: HistoryRecord[]
  csrfToken: string
}) {
  const data = useMemo<HistoryTableRow[]>(
    () =>
      history.map((record) => ({
        ...record,
        search: [
          record.type,
          record.id,
          record.from,
          record.to,
          record.installed_at,
          record.rolled_back_at,
        ]
          .filter(Boolean)
          .join(" "),
      })),
    [history]
  )

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("search", {
          id: "search",
          header: "Търсене",
          enableSorting: false,
          filterFn: "includesString",
        }),
        columnHelper.accessor("type", {
          header: "Тип",
          cell: ({ getValue }) => typeLabel(getValue()),
          sortFn: "auto",
        }),
        columnHelper.accessor("id", {
          header: "ID",
          cell: ({ getValue }) => <code>{getValue() ?? "—"}</code>,
          sortFn: "auto",
        }),
        columnHelper.accessor("from", { header: "От", sortFn: "auto" }),
        columnHelper.accessor("to", { header: "До", sortFn: "auto" }),
        columnHelper.accessor(
          (record) => record.installed_at ?? record.rolled_back_at ?? "",
          {
            id: "date",
            header: "Дата",
            cell: ({ getValue }) => formatDate(getValue()),
            sortFn: "auto",
            sortDescFirst: true,
          }
        ),
        columnHelper.display({
          id: "actions",
          header: "Действия",
          cell: ({ row }) => (
            <RollbackForm csrfToken={csrfToken} record={row.original} />
          ),
          enableSorting: false,
        }),
      ]),
    [csrfToken]
  )

  const table = useTable(
    {
      features,
      data,
      columns,
      getRowId: (record, index) => `${record.id ?? "history"}-${index}`,
      initialState: {
        columnVisibility: { search: false },
        sorting: [{ id: "date", desc: true }],
        pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
      },
      enableSortingRemoval: false,
    },
    (state) => state
  )

  const pageIndex = table.state.pagination.pageIndex
  const pageCount = table.getPageCount()
  const filteredRows = table.getFilteredRowModel().rows.length
  const searchColumn = table.getColumn("search")
  const first = filteredRows === 0 ? 0 : pageIndex * PAGE_SIZE + 1
  const last = Math.min((pageIndex + 1) * PAGE_SIZE, filteredRows)

  return (
    <div className="space-y-4">
      <div className="max-w-sm relative">
        <Search
          className="left-2 size-4 pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label className="sr-only" htmlFor="history-search">
          Търсене в историята
        </label>
        <Input
          id="history-search"
          className="pl-8"
          placeholder="Търсене в историята..."
          value={String(searchColumn?.getFilterValue() ?? "")}
          onChange={(event) => {
            table.setPageIndex(0)
            searchColumn?.setFilterValue(event.target.value)
          }}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table className="min-w-[48rem]">
          <TableCaption className="sr-only">
            История на обновяванията на Flex CMS
          </TableCaption>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const SortIcon =
                    sorted === "desc"
                      ? ArrowDown
                      : sorted === "asc"
                        ? ArrowUp
                        : ArrowUpDown
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === "desc"
                          ? "descending"
                          : sorted === "asc"
                            ? "ascending"
                            : "none"
                      }
                      className={`border-r border-border last:border-r-0 ${header.column.id === "actions" ? "text-right" : ""}`}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-auto rounded-none border-0 bg-transparent px-2 py-1 font-medium shadow-none hover:bg-muted"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          <SortIcon className="size-3.5" aria-hidden="true" />
                        </Button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-20 text-center text-muted-foreground"
                >
                  Няма намерени записи.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`border-r border-border last:border-r-0 ${cell.column.id === "actions" ? "text-right" : ""}`}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="gap-3 text-sm flex flex-wrap items-center justify-between text-muted-foreground">
        <p aria-live="polite">
          Показване {first}–{last} от {filteredRows}
        </p>
        <nav className="gap-1 flex items-center" aria-label="Страници">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Предишна страница"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          {paginationItems(pageIndex, pageCount).map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="size-7 flex items-center justify-center"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                type="button"
                key={item}
                variant={item === pageIndex ? "secondary" : "outline"}
                size="icon-sm"
                aria-current={item === pageIndex ? "page" : undefined}
                aria-label={`Страница ${item + 1}`}
                onClick={() => table.setPageIndex(item)}
              >
                {item + 1}
              </Button>
            )
          )}
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Следваща страница"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </div>
  )
}
