import type { ReactNode } from "react"

export type TableSkeletonColumn = {
  key: string
  label?: string
}

export function tableSkeletonCellClass(columnKey: string): string {
  if (columnKey === "actions") return " react-table-skeleton-cell-actions"
  if (
    /^(title|name|email|file|body|slug|original_name|comment|description|product_name)$/.test(
      columnKey,
    )
  ) {
    return " react-table-skeleton-cell-wide"
  }
  return ""
}

type TableSkeletonRowsProps = {
  columns: readonly TableSkeletonColumn[]
  columnCount: number
  selectable?: boolean
  rowCount?: number
  statusMessage?: string
}

export function TableSkeletonRows({
  columns,
  columnCount,
  selectable = false,
  rowCount = 8,
  statusMessage = "Зареждане…",
}: TableSkeletonRowsProps) {
  return (
    <>
      <tr className="react-table-skeleton-status">
        <td colSpan={columnCount}>
          <span role="status" aria-live="polite" aria-busy="true">
            {statusMessage}
          </span>
        </td>
      </tr>
      {Array.from({ length: rowCount }, (_, index) => (
        <tr key={index} className="react-table-skeleton-row" aria-hidden="true">
          {selectable && (
            <td className="react-selection-column">
              <span className="admin-skeleton-shimmer react-table-skeleton-check" />
            </td>
          )}
          {columns.map((column) => (
            <td
              key={column.key}
              className={column.key === "actions" ? "react-actions-column" : undefined}
            >
              <span
                className={`admin-skeleton-shimmer react-table-skeleton-cell${tableSkeletonCellClass(column.key)}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function TableSkeleton({
  columns,
  selectable = false,
  rowCount = 8,
  statusMessage = "Зареждане…",
  toolbar,
  className = "",
}: {
  columns: readonly TableSkeletonColumn[]
  selectable?: boolean
  rowCount?: number
  statusMessage?: string
  toolbar?: ReactNode
  className?: string
}) {
  const columnCount = columns.length + (selectable ? 1 : 0)
  return (
    <div className={`react-table-card${className ? ` ${className}` : ""}`}>
      {toolbar && (
        <div className="react-table-toolbar react-table-toolbar-skeleton" aria-hidden="true">
          {toolbar}
        </div>
      )}
      <div className="react-table-scroll">
        <table className="react-data-table">
          <thead>
            <tr>
              {selectable && (
                <th className="react-selection-column">
                  <span
                    className="admin-skeleton-shimmer react-table-skeleton-check"
                    aria-hidden="true"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.key}>{column.label ?? column.key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <TableSkeletonRows
              columns={columns}
              columnCount={columnCount}
              selectable={selectable}
              rowCount={rowCount}
              statusMessage={statusMessage}
            />
          </tbody>
        </table>
      </div>
    </div>
  )
}
