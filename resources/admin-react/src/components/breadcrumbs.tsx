import { t } from "@/lib/admin-i18n"

type BreadcrumbItem = {
  label: string
  onClick?: () => void
}

export function Breadcrumbs({
  items,
  onHomeClick,
}: {
  items: BreadcrumbItem[]
  onHomeClick?: () => void
}) {
  return (
    <nav className="react-breadcrumbs" aria-label={t("Navigation breadcrumbs")}>
      <a
        href="#dashboard"
        onClick={(event) => {
          event.preventDefault()
          onHomeClick?.()
        }}
      >
        {t("Dashboard")}
      </a>
      {items.map((item, index) => (
        <span className="react-breadcrumb-item" key={`${item.label}-${index}`}>
          <span className="react-breadcrumb-separator" aria-hidden="true">
            /
          </span>
          {item.onClick ? (
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault()
                item.onClick?.()
              }}
            >
              {t(item.label)}
            </a>
          ) : (
            <strong aria-current="page">{t(item.label)}</strong>
          )}
        </span>
      ))}
    </nav>
  )
}
