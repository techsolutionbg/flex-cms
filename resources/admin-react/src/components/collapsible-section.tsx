import type { LucideIcon } from "lucide-react"
import { ChevronDown } from "lucide-react"
import { useState, type ReactNode } from "react"

type CollapsibleSectionProps = {
  title: string
  icon?: LucideIcon
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true, className = "" }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return <section className={`collapsible-section${open ? " is-open" : " is-closed"}${className ? ` ${className}` : ""}`}>
    <button className="collapsible-section-header" type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      {Icon && <Icon aria-hidden="true" />}
      <span>{title}</span>
      <ChevronDown className="collapsible-section-chevron" aria-hidden="true" />
    </button>
    <div className="collapsible-section-body"><div className="collapsible-section-body-inner">{children}</div></div>
  </section>
}
