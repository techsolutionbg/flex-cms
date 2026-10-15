import { cloneElement, isValidElement, useId, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { t } from "@/lib/admin-i18n"

type TooltipPlacement = "top" | "bottom" | "left" | "right"

/** Small, reusable tooltip for controls that need a visible hover and keyboard hint. */
export function Tooltip({
  content,
  children,
  placement = "auto",
}: {
  content: string
  children: ReactNode
  placement?: TooltipPlacement | "auto"
}) {
  const id = useId()
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [currentPlacement, setCurrentPlacement] = useState<TooltipPlacement>(
    placement === "auto" ? "bottom" : placement,
  )
  const [position, setPosition] = useState({ top: -9999, left: -9999 })
  const trigger = isValidElement<{ "aria-describedby"?: string }>(children)
    ? cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" "),
      })
    : children
  function updatePlacement(anchor: HTMLElement) {
    if (placement !== "auto") {
      setCurrentPlacement(placement)
      return
    }
    const tooltip = tooltipRef.current
    if (!tooltip) return
    const triggerRect = anchor.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    const gap = 8
    const verticalCenterFits =
      triggerRect.top + triggerRect.height / 2 >= tooltipRect.height / 2 + gap &&
      window.innerHeight - (triggerRect.top + triggerRect.height / 2) >= tooltipRect.height / 2 + gap
    const placements: TooltipPlacement[] = ["bottom", "top", "right", "left"]
    const fits = placements.find((side) => {
      if (side === "bottom") return window.innerHeight - triggerRect.bottom >= tooltipRect.height + gap
      if (side === "top") return triggerRect.top >= tooltipRect.height + gap
      if (!verticalCenterFits) return false
      if (side === "right") return window.innerWidth - triggerRect.right >= tooltipRect.width + gap
      return triggerRect.left >= tooltipRect.width + gap
    })
    const nextPlacement = placement === "auto" ? (fits ?? "bottom") : placement
    setCurrentPlacement(nextPlacement)
    const left =
      nextPlacement === "left"
        ? triggerRect.left - tooltipRect.width - gap
        : nextPlacement === "right"
          ? triggerRect.right + gap
          : triggerRect.left + triggerRect.width / 2
    const top =
      nextPlacement === "top"
        ? triggerRect.top - tooltipRect.height - gap
        : nextPlacement === "bottom"
          ? triggerRect.bottom + gap
          : triggerRect.top + triggerRect.height / 2
    setPosition({
      left: Math.min(Math.max(8, nextPlacement === "left" || nextPlacement === "right" ? left : left - tooltipRect.width / 2), window.innerWidth - tooltipRect.width - 8),
      top: Math.min(Math.max(8, nextPlacement === "top" || nextPlacement === "bottom" ? top : top - tooltipRect.height / 2), window.innerHeight - tooltipRect.height - 8),
    })
  }
  return (
    <span
      className="react-tooltip-anchor"
      onPointerEnter={(event) => {
        updatePlacement(event.currentTarget)
        setVisible(true)
      }}
      onPointerLeave={() => setVisible(false)}
      onFocusCapture={(event) => {
        updatePlacement(event.currentTarget)
        setVisible(true)
      }}
      onBlurCapture={() => setVisible(false)}
    >
      {trigger}
      {createPortal(
        <span
          ref={tooltipRef}
          className={`react-tooltip-content${visible ? " is-visible" : ""}`}
          id={id}
          role="tooltip"
          data-placement={currentPlacement}
          style={{ position: "fixed", top: position.top, left: position.left, right: "auto", bottom: "auto", transform: "none" }}
        >
          {t(content)}
        </span>,
        document.body,
      )}
    </span>
  )
}
