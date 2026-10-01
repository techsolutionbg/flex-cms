type BreadcrumbItem = {
  label: string
  onClick?: () => void
}

export function Breadcrumbs({ items, onHomeClick }: { items: BreadcrumbItem[]; onHomeClick?: () => void }) {
  return <nav className="react-breadcrumbs" aria-label="Навигационни пътеки">
    <a href="#dashboard" onClick={(event) => { event.preventDefault(); onHomeClick?.() }}>Табло</a>
    {items.map((item, index) => <span className="react-breadcrumb-item" key={`${item.label}-${index}`}>
      <span className="react-breadcrumb-separator" aria-hidden="true">/</span>
      {item.onClick ? <a href="#" onClick={(event) => { event.preventDefault(); item.onClick?.() }}>{item.label}</a> : <strong aria-current="page">{item.label}</strong>}
    </span>)}
  </nav>
}
