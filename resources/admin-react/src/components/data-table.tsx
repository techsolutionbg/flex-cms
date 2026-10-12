import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { useEffect, useId, useMemo, useState, type ReactNode } from "react"
import { PaginationControls } from "./pagination-controls"
import { TableSkeletonRows } from "./table-skeleton"
import { TableActionsMenu } from "./table-actions-menu"
import {
  ExtensionComponent,
  RowExtensionActionsContext,
  useTableExtensions,
  type ExtensionRowAction,
} from "./extension-runtime"

export type DataTableColumn<T> = {
  key: string
  label: string
  sortable?: boolean
  render?: (row: T) => ReactNode
  sortValue?: (row: T) => string | number
}
type DataTableProps<T> = {
  data: T[]
  columns: DataTableColumn<T>[]
  rowKey: (row: T) => string | number
  loading?: boolean
  emptyMessage?: string
  toolbar?: ReactNode
  bulkActions?: ReactNode
  pageSize?: number
  selectable?: boolean
  selectedKeys?: ReadonlySet<string | number>
  onSelectionChange?: (keys: Set<string | number>) => void
  filterStorageKey?: string
  /** Name of this table for plugin columns, row actions, bulk actions and filters, e.g. "users.list". */
  extensionPoint?: string
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  emptyMessage = "Няма записи.",
  toolbar,
  bulkActions,
  pageSize = 10,
  selectable = false,
  selectedKeys = new Set(),
  onSelectionChange,
  filterStorageKey,
  extensionPoint,
}: DataTableProps<T>) {
  const rowsKey = useMemo(() => data.map(rowKey).join("0000"), [data, rowKey])
  const extensions = useTableExtensions(extensionPoint, data, rowsKey)
  // One stable setter per toolbar extension, so plugins can depend on it in effects.
  const toolbarFilters = useMemo(
    () =>
      Object.fromEntries(
        extensions.toolbars.map((descriptor) => [
          descriptor.id,
          (filter: ((row: T) => boolean) | null) => extensions.setFilter(descriptor.id, filter),
        ]),
      ),
    [extensions.toolbars, extensions.setFilter],
  )
  const visibleRows = useMemo(
    () => (extensions.filter ? data.filter(extensions.filter) : data),
    [data, extensions.filter],
  )
  const tableColumns = useMemo(() => {
    const actionsIndex = columns.findIndex((column) => column.key === "actions")
    const withExtensions =
      actionsIndex < 0
        ? [...columns, ...extensions.columns]
        : [...columns.slice(0, actionsIndex), ...extensions.columns, ...columns.slice(actionsIndex)]
    // Plugin row actions need the actions menu even on tables that have none of their own.
    if (actionsIndex < 0 && extensions.rowActions.length > 0)
      withExtensions.push({
        key: "actions",
        label: "Действия",
        render: () => <TableActionsMenu>{null}</TableActionsMenu>,
      })
    return withExtensions
  }, [columns, extensions.columns, extensions.rowActions.length])
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [descending, setDescending] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [toolbarOpen, setToolbarOpen] = useState(() => {
    if (!filterStorageKey || typeof window === "undefined") return true
    try {
      return (
        window.localStorage.getItem(`flex-admin:table-filters:${filterStorageKey}`) !== "closed"
      )
    } catch {
      return true
    }
  })
  const filterContentId = useId()
  const sortedData = useMemo(() => {
    if (!sortKey) return visibleRows
    const column = tableColumns.find((item) => item.key === sortKey)
    if (!column) return visibleRows
    return [...visibleRows].sort((left, right) => {
      const leftValue =
        column.sortValue?.(left) ?? String((left as Record<string, unknown>)[column.key] ?? "")
      const rightValue =
        column.sortValue?.(right) ?? String((right as Record<string, unknown>)[column.key] ?? "")
      const result =
        typeof leftValue === "number" && typeof rightValue === "number"
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), "bg", {
              numeric: true,
              sensitivity: "base",
            })
      return descending ? -result : result
    })
  }, [tableColumns, visibleRows, descending, sortKey])
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const activePage = Math.max(1, Math.min(currentPage, totalPages))
  const visibleData = sortedData.slice((activePage - 1) * pageSize, activePage * pageSize)
  const visibleKeys = visibleData.map(rowKey)
  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key))
  useEffect(() => setCurrentPage(1), [visibleRows, sortKey, descending])
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])
  useEffect(() => {
    if (!filterStorageKey || typeof window === "undefined") return
    try {
      window.localStorage.setItem(
        `flex-admin:table-filters:${filterStorageKey}`,
        toolbarOpen ? "open" : "closed",
      )
    } catch {
      /* localStorage may be unavailable */
    }
  }, [filterStorageKey, toolbarOpen])
  function sort(column: DataTableColumn<T>) {
    if (!column.sortable) return
    if (sortKey === column.key) setDescending((current) => !current)
    else {
      setSortKey(column.key)
      setDescending(false)
    }
  }
  function toggleSelection(key: string | number, checked: boolean) {
    const next = new Set(selectedKeys)
    if (checked) next.add(key)
    else next.delete(key)
    onSelectionChange?.(next)
  }
  function toggleVisibleSelection(checked: boolean) {
    const next = new Set(selectedKeys)
    visibleKeys.forEach((key) => (checked ? next.add(key) : next.delete(key)))
    onSelectionChange?.(next)
  }
  const columnCount = tableColumns.length + (selectable ? 1 : 0)
  const selectedRows = data.filter((row) => selectedKeys.has(rowKey(row)))
  const extensionBulk = selectable && selectedRows.length > 0 ? extensions.bulkActions : []
  const hasToolbar = Boolean(toolbar) || extensions.toolbars.length > 0
  const rowActions = extensions.rowActions as ExtensionRowAction<unknown>[]
  return (
    <div className="react-table-card">
      {hasToolbar && (
        <div className={`react-table-filter-panel${toolbarOpen ? " is-open" : " is-closed"}`}>
          <div className="react-table-filter-header">
            <span>Филтри и търсене</span>
            <button
              type="button"
              aria-expanded={toolbarOpen}
              aria-controls={filterContentId}
              onClick={() => setToolbarOpen((current) => !current)}
            >
              {toolbarOpen ? "Скрий" : "Покажи"}
              <ChevronDown aria-hidden="true" />
            </button>
          </div>
          <div className="react-table-filter-body" id={filterContentId}>
            <div className="react-table-filter-body-inner">
              <div className="react-table-toolbar">
                {toolbar}
                {extensions.toolbars.map((descriptor) => (
                  <ExtensionComponent
                    key={descriptor.id}
                    descriptor={descriptor}
                    props={{
                      rows: data,
                      setFilter: toolbarFilters[descriptor.id],
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {(bulkActions || extensionBulk.length > 0) && (
        <div className="react-bulk-toolbar">
          {bulkActions}
          {extensionBulk.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.danger ? "react-danger-button" : "react-secondary-button"}
              onClick={() => void action.run(selectedRows, extensions.helpers)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      <div className="react-table-scroll">
        <table className="react-data-table">
          <thead>
            <tr>
              {selectable && (
                <th className="react-selection-column">
                  <input
                    type="checkbox"
                    aria-label="Избери всички видими записи"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleVisibleSelection(event.target.checked)}
                  />
                </th>
              )}
              {tableColumns.map((column) => (
                <th key={column.key}>
                  <button
                    className={`react-sort-button${column.sortable ? " is-sortable" : ""}`}
                    type="button"
                    onClick={() => sort(column)}
                    disabled={!column.sortable}
                  >
                    {column.label}
                    {column.sortable &&
                      (sortKey === column.key ? (
                        descending ? (
                          <ArrowDown />
                        ) : (
                          <ArrowUp />
                        )
                      ) : (
                        <ChevronsUpDown />
                      ))}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows
                columns={tableColumns}
                columnCount={columnCount}
                selectable={selectable}
              />
            ) : sortedData.length === 0 ? (
              <tr>
                <td className="react-table-empty" colSpan={columnCount}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleData.map((row) => (
                <tr key={rowKey(row)}>
                  {selectable && (
                    <td className="react-selection-column">
                      <input
                        type="checkbox"
                        aria-label="Избери запис"
                        checked={selectedKeys.has(rowKey(row))}
                        onChange={(event) => toggleSelection(rowKey(row), event.target.checked)}
                      />
                    </td>
                  )}
                  {tableColumns.map((column) => (
                    <td
                      key={column.key}
                      className={column.key === "actions" ? "react-actions-column" : undefined}
                    >
                      {column.key === "actions" && rowActions.length > 0 ? (
                        <RowExtensionActionsContext.Provider
                          value={{ row, actions: rowActions, helpers: extensions.helpers }}
                        >
                          {column.render?.(row)}
                        </RowExtensionActionsContext.Provider>
                      ) : column.render ? (
                        column.render(row)
                      ) : (
                        String((row as Record<string, unknown>)[column.key] ?? "—")
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="react-pagination">
        <span>
          Показани {sortedData.length === 0 ? 0 : (activePage - 1) * pageSize + 1}–
          {Math.min(activePage * pageSize, sortedData.length)} от {sortedData.length}
        </span>
        <PaginationControls
          page={activePage}
          totalPages={totalPages}
          loading={loading}
          onChange={setCurrentPage}
        />
      </div>
    </div>
  )
}
