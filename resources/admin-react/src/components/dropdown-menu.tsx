import { ChevronDown } from "lucide-react"
import { createPortal } from "react-dom"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

type DropdownMenuProps = {
  trigger: ReactNode
  children: ReactNode
  ariaLabel: string
  triggerVariant?: "dropdown-trigger" | "secondary"
  triggerClassName?: string
}

export function DropdownMenu({
  trigger,
  children,
  ariaLabel,
  triggerClassName = "",
  triggerVariant = "dropdown-trigger",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 176 })

  function reposition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect)
      setPosition({
        top: rect.bottom + 6,
        left: Math.max(8, rect.right - Math.max(rect.width, 176)),
        width: Math.max(rect.width, 176),
      })
  }

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !(event.target as Element).closest(".universal-dropdown-menu")
      )
        setOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", closeOnOutside)
    document.addEventListener("keydown", closeOnEscape)
    if (open) {
      reposition()
      window.addEventListener("resize", reposition)
      window.addEventListener("scroll", reposition, true)
    }
    return () => {
      document.removeEventListener("mousedown", closeOnOutside)
      document.removeEventListener("keydown", closeOnEscape)
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [open])

  return (
    <div className="universal-dropdown" ref={rootRef}>
      <Button
        variant={triggerVariant}
        ref={triggerRef}
        className={triggerClassName}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </Button>
      {open &&
        createPortal(
          <div
            className={`universal-dropdown-menu${rootRef.current?.closest(".media-page-content, .media-picker-dialog") ? " media-dropdown-menu" : ""}`}
            role="menu"
            style={{ top: position.top, left: position.left, minWidth: position.width }}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>,
          rootRef.current?.closest("dialog[open]") ?? document.body,
        )}
    </div>
  )
}

export function DropdownOption({
  children,
  selected = false,
  danger = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode
  selected?: boolean
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="dropdown-option"
      className={`${selected ? "is-selected" : ""}${danger ? " is-danger" : ""}`}
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function DropdownChevron() {
  return <ChevronDown className="universal-dropdown-chevron" aria-hidden="true" />
}
