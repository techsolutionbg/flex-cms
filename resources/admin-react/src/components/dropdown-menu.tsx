import { ChevronDown } from "lucide-react"
import { createPortal } from "react-dom"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
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
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 176, maxHeight: 320 })

  function reposition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect || !menuRef.current) return
    const viewport = window.visualViewport
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportHeight = viewport?.height ?? window.innerHeight
    const viewportWidth = viewport?.width ?? window.innerWidth
    const below = Math.max(0, viewportTop + viewportHeight - rect.bottom - 14)
    const above = Math.max(0, rect.top - viewportTop - 14)
    const desiredHeight = Math.min(menuRef.current.scrollHeight + 2, 320)
    const openAbove = below < desiredHeight && above > below
    const maxHeight = Math.min(320, openAbove ? above : below)
    const height = Math.min(desiredHeight, maxHeight)
    const width = Math.min(Math.max(rect.width, 176), Math.max(0, viewportWidth - 16))
    setPosition({
      top: Math.max(viewportTop + 8, openAbove ? rect.top - 6 - height : rect.bottom + 6),
      left: Math.max(
        viewportLeft + 8,
        Math.min(rect.right - width, viewportLeft + viewportWidth - width - 8),
      ),
      width,
      maxHeight,
    })
  }

  useLayoutEffect(() => {
    if (open) reposition()
  }, [open, children])

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
      window.visualViewport?.addEventListener("resize", reposition)
      window.visualViewport?.addEventListener("scroll", reposition)
    }
    return () => {
      document.removeEventListener("mousedown", closeOnOutside)
      document.removeEventListener("keydown", closeOnEscape)
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
      window.visualViewport?.removeEventListener("resize", reposition)
      window.visualViewport?.removeEventListener("scroll", reposition)
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
            ref={menuRef}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              overflowY: "auto",
            }}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>,
          rootRef.current?.closest(".code-editor-shell.is-fullscreen, dialog[open]") ??
            document.body,
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
