export type DataTableColumn = {
  key: string
  label: string
  sortable?: boolean
  linkTemplate?: string
}

type DataTableConfig = {
  columns: DataTableColumn[]
}

type DataTableRow = Record<string, unknown>

type DataTableState = {
  columns: DataTableColumn[]
  sourceRows: DataTableRow[]
  sortKey: string
  sortDirection: "asc" | "desc"
  currentPage: number
  pageSize: number
  sortedRows: DataTableRow[]
  totalPages: number
  paginatedRows: DataTableRow[]
  visiblePages: number[]
  configure(config: DataTableConfig): void
  setRows(rows: DataTableRow[]): void
  sortBy(key: string): void
  goToPage(page: number): void
  formatCell(row: DataTableRow, key: string): string
  linkFor(row: DataTableRow, column: DataTableColumn): string
}

function paginationIcon(direction: "previous" | "next"): string {
  const path = direction === "previous" ? "M15 18 9 12l6-6" : "m9 18 6-6-6-6"
  return `<svg class="pagination-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg>`
}

export function actionDropdownMarkup(actionsMarkup: string): string {
  return `<div class="table-action-dropdown" x-data="{ open: false, menuStyle: '', reposition() { const rect = $refs.trigger.getBoundingClientRect(); const width = 160; const height = 52; const opensAbove = window.innerHeight - rect.bottom < height + 12 && rect.top > height + 12; this.menuStyle = \`left: \${Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))}px; top: \${opensAbove ? rect.top - height - 8 : rect.bottom + 8}px; width: \${width}px;\`; } }" @click.outside="open = false" @keydown.escape.window="open = false" @resize.window="if (open) reposition()" @scroll.window="if (open) reposition()"><button x-ref="trigger" class="table-action-trigger" type="button" aria-label="Отвори действията" :aria-expanded="open" @click="open = !open; if (open) $nextTick(() => reposition())"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg></button><template x-teleport="body"><div class="dropdown-menu table-action-menu" @click.stop="open = false" :style="menuStyle" x-show="open" x-transition:enter="dropdown-transition" x-transition:enter-start="dropdown-transition-start" x-transition:enter-end="dropdown-transition-end" x-transition:leave="dropdown-transition" x-transition:leave-start="dropdown-transition-end" x-transition:leave-end="dropdown-transition-start">${actionsMarkup}</div></template></div>`
}

export function dataTableMarkup(rowsExpression: string, columns: DataTableColumn[], actionsMarkup: string): string {
  const config: DataTableConfig = { columns }

  return `<div class="data-table" x-data="dataTable" x-init='configure(${JSON.stringify(config)})' x-effect="setRows(${rowsExpression})"><div class="table-wrapper"><table><thead><tr><template x-for="column in columns" :key="column.key"><th scope="col"><button class="table-sort" type="button" x-show="column.sortable" @click="sortBy(column.key)" :aria-label="\`Сортиране по \${column.label}\`"><span x-text="column.label"></span><span class="table-sort-icon" :class="{ 'is-active': sortKey === column.key }" x-text="sortKey === column.key && sortDirection === 'desc' ? '↓' : '↑'"></span></button><span x-show="!column.sortable" x-text="column.label"></span></th></template><th class="table-actions" scope="col">Действия</th></tr></thead><tbody><template x-for="row in paginatedRows" :key="row.id"><tr><template x-for="column in columns" :key="column.key"><td><a class="table-link" x-show="column.linkTemplate" :href="linkFor(row, column)" x-text="formatCell(row, column.key)"></a><span x-show="!column.linkTemplate" x-text="formatCell(row, column.key)"></span></td></template><td class="table-actions">${actionsMarkup}</td></tr></template><tr x-show="paginatedRows.length === 0"><td class="table-empty" :colspan="columns.length + 1">Няма намерени записи.</td></tr></tbody></table></div><div class="table-footer" x-show="totalPages > 0"><span class="table-summary" x-text="\`Показани \${((currentPage - 1) * pageSize) + 1}–\${Math.min(currentPage * pageSize, sortedRows.length)} от \${sortedRows.length}\`"></span><nav class="pagination" aria-label="Страници"><button class="pagination-button pagination-arrow" type="button" aria-label="Предишна страница" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">${paginationIcon("previous")}</button><template x-for="number in visiblePages" :key="number"><button class="pagination-button" type="button" :class="{ 'is-active': number === currentPage }" :aria-current="number === currentPage ? 'page' : undefined" x-text="number" @click="goToPage(number)"></button></template><button class="pagination-button pagination-arrow" type="button" aria-label="Следваща страница" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">${paginationIcon("next")}</button></nav></div></div>`
}

export function registerDataTable(Alpine: typeof import("alpinejs").default): void {
  Alpine.data("dataTable", (): DataTableState => ({
    columns: [] as DataTableColumn[],
    sourceRows: [] as DataTableRow[],
    sortKey: "",
    sortDirection: "asc" as "asc" | "desc",
    currentPage: 1,
    pageSize: 10,
    configure(this: DataTableState, config: DataTableConfig) {
      this.columns = config.columns
      this.sortKey = ""
    },
    setRows(this: DataTableState, rows: DataTableRow[]) {
      this.sourceRows = Array.isArray(rows) ? rows : []
      if (this.currentPage > this.totalPages) this.currentPage = Math.max(1, this.totalPages)
    },
    get sortedRows() {
      if (!this.sortKey) return [...this.sourceRows]
      return [...this.sourceRows].sort((left, right) => {
        const leftValue = String(left[this.sortKey] ?? "").toLocaleLowerCase()
        const rightValue = String(right[this.sortKey] ?? "").toLocaleLowerCase()
        const comparison = leftValue.localeCompare(rightValue, "bg", { numeric: true })
        return this.sortDirection === "asc" ? comparison : -comparison
      })
    },
    get totalPages() {
      return Math.ceil(this.sortedRows.length / this.pageSize)
    },
    get paginatedRows() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.sortedRows.slice(start, start + this.pageSize)
    },
    get visiblePages() {
      const total = this.totalPages
      const maxVisible = 5
      let start = Math.max(1, this.currentPage - 2)
      const end = Math.min(total, start + maxVisible - 1)
      start = Math.max(1, end - maxVisible + 1)
      return Array.from({ length: end - start + 1 }, (_, index) => start + index)
    },
    sortBy(this: DataTableState, key: string) {
      const column = this.columns.find((item) => item.key === key)
      if (!column?.sortable) return
      if (this.sortKey === key) this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc"
      else { this.sortKey = key; this.sortDirection = "asc" }
      this.currentPage = 1
    },
    goToPage(this: DataTableState, page: number) {
      this.currentPage = Math.min(Math.max(1, page), Math.max(1, this.totalPages))
    },
    formatCell(row: DataTableRow, key: string) {
      const value = row[key]
      if (key === "title" && typeof row.depth === "number" && row.depth > 0) return `${"— ".repeat(row.depth)}${String(value ?? "—")}`
      if (key === "status") return value === "published" ? "Публикувана" : "Чернова"
      if (key.endsWith("_at") && value) return new Date(String(value)).toLocaleString("bg-BG")
      return String(value ?? "—")
    },
    linkFor(row: DataTableRow, column: DataTableColumn) {
      return (column.linkTemplate ?? "").replace(/\{([^}]+)\}/g, (_, key: string) => encodeURIComponent(String(row[key] ?? "")))
    },
  }))
}
