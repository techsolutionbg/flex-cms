import type { LucideIcon } from "lucide-react"
import { ChevronDown } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { ExtensionComponent, ExtensionSlot, panelIcon, useExtensions } from "./extension-runtime"

type CollapsibleSectionProps = {
  title: string
  icon?: LucideIcon
  children: ReactNode
  defaultOpen?: boolean
  storageKey?: string
  className?: string
  /** Name of this section for plugin content, e.g. "page.editor.publishing" (slots section.start, section.end, section.nested). */
  extensionPoint?: string
}

export function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  storageKey,
  className = "",
  extensionPoint,
}: CollapsibleSectionProps) {
  const nested = useExtensions(extensionPoint, "section.nested")
  const persistenceKey = `flex-admin-collapsible:${storageKey ?? title}`
  const [open, setOpen] = useState(() => {
    try {
      const saved = window.localStorage.getItem(persistenceKey)
      return saved === null ? defaultOpen : saved === "open"
    } catch {
      return defaultOpen
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(persistenceKey, open ? "open" : "closed")
    } catch {}
  }, [open, persistenceKey])

  return (
    <section
      className={`collapsible-section${open ? " is-open" : " is-closed"}${className ? ` ${className}` : ""}`}
      onInvalidCapture={(event) => {
        if (open) return
        event.preventDefault()
        setOpen(true)
        const field = event.target as HTMLInputElement
        window.setTimeout(() => {
          if (field.isConnected) {
            field.focus()
            field.reportValidity()
          }
        }, 250)
      }}
    >
      <button
        className="collapsible-section-header"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {Icon && <Icon aria-hidden="true" />}
        <span>{title}</span>
        <ChevronDown className="collapsible-section-chevron" aria-hidden="true" />
      </button>
      <div className="collapsible-section-body" inert={!open}>
        <div className="collapsible-section-body-inner">
          <ExtensionSlot point={extensionPoint} slot="section.start" />
          {children}
          <ExtensionSlot point={extensionPoint} slot="section.end" />
          {nested.map((extension) => (
            <CollapsibleSection
              key={extension.id}
              title={extension.label}
              icon={panelIcon(extension.icon)}
              defaultOpen={extension.default_open}
              storageKey={`nested:${extensionPoint}:${extension.id}`}
              className={`extension-nested-section extension-panel-${extension.id}`}
            >
              <ExtensionComponent descriptor={extension} />
            </CollapsibleSection>
          ))}
        </div>
      </div>
    </section>
  )
}
