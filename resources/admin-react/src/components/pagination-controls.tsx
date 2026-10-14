import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { t } from "@/lib/admin-i18n"

export function PaginationControls({
  page,
  totalPages,
  loading = false,
  onChange,
}: {
  page: number
  totalPages: number
  loading?: boolean
  onChange: (page: number) => void
}) {
  const total = Math.max(1, totalPages)
  const current = Math.max(1, Math.min(page, total))
  const end = Math.min(total, Math.max(5, current + 2))
  const start = Math.max(1, end - 4)
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index)
  return (
    <nav className="react-pagination-controls" aria-label={t("Table pages")}>
      <button
        type="button"
        aria-label={t("First page")}
        title={t("First page")}
        disabled={loading || current === 1}
        onClick={() => onChange(1)}
      >
        <ChevronsLeft size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t("Previous page")}
        title={t("Previous page")}
        disabled={loading || current === 1}
        onClick={() => onChange(current - 1)}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      {start > 1 && (
        <span className="react-pagination-ellipsis" aria-hidden="true">
          …
        </span>
      )}
      {pages.map((number) => (
        <button
          type="button"
          key={number}
          aria-label={`${t("Page")} ${number}`}
          aria-current={number === current ? "page" : undefined}
          disabled={loading || number === current}
          onClick={() => onChange(number)}
        >
          {number}
        </button>
      ))}
      {end < total && (
        <span className="react-pagination-ellipsis" aria-hidden="true">
          …
        </span>
      )}
      <button
        type="button"
        aria-label={t("Next page")}
        title={t("Next page")}
        disabled={loading || current === total}
        onClick={() => onChange(current + 1)}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t("Last page")}
        title={t("Last page")}
        disabled={loading || current === total}
        onClick={() => onChange(total)}
      >
        <ChevronsRight size={18} aria-hidden="true" />
      </button>
    </nav>
  )
}
