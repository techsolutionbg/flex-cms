import { Gauge, PanelLeft, RefreshCw } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { AdminBootstrap } from "@/types"

const MIN_WIDTH = 180
const MAX_WIDTH = 420

export function AdminSidebar({
  page,
  version,
  initialWidth,
  csrfToken,
}: {
  page: AdminBootstrap["page"]
  version: string
  initialWidth: number
  csrfToken: string
}) {
  const [width, setWidth] = useState(
    Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, initialWidth))
  )
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("flexcms.admin.sidebarCollapsed") === "true"
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const dragging = useRef(false)

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`)
  }, [width])

  function toggle(): void {
    if (window.matchMedia("(max-width: 48rem)").matches) {
      setMobileOpen((value) => !value)
      return
    }
    setCollapsed((value) => {
      localStorage.setItem("flexcms.admin.sidebarCollapsed", String(!value))
      return !value
    })
  }

  function persist(nextWidth: number): void {
    void fetch("/admin/sidebar-width", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: new URLSearchParams({
        _token: csrfToken,
        width: String(nextWidth),
      }),
    })
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>): void {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function resize(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragging.current) return
    setWidth(
      Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(event.clientX)))
    )
  }

  function stopResize(event: React.PointerEvent<HTMLDivElement>): void {
    if (!dragging.current) return
    dragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
    persist(width)
  }

  const expanded = !collapsed || mobileOpen
  const shellClass = [
    collapsed ? "sidebar-collapsed" : "",
    mobileOpen ? "sidebar-mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={shellClass}>
      <button
        className="sidebar-toggle"
        type="button"
        aria-controls="admin-sidebar"
        aria-label={
          expanded ? "Прибери страничната лента" : "Покажи страничната лента"
        }
        aria-expanded={expanded}
        onClick={toggle}
      >
        <PanelLeft aria-hidden="true" />
      </button>
      <aside
        id="admin-sidebar"
        className="admin-sidebar"
        aria-hidden={!expanded}
      >
        <div
          className="sidebar-resizer"
          role="separator"
          tabIndex={collapsed ? -1 : 0}
          aria-label="Промени широчината на страничната лента"
          aria-orientation="vertical"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={width}
          onPointerDown={startResize}
          onPointerMove={resize}
          onPointerUp={stopResize}
        />
        <div className="sidebar-brand">
          <img
            className="sidebar-logo"
            src="/assets/brand/logo.png"
            alt="Flex CMS"
          />
        </div>
        <nav aria-label="Административна навигация">
          <a
            className={`sidebar-link${page === "dashboard" ? "is-active" : ""}`}
            href="/admin"
            aria-current={page === "dashboard" ? "page" : undefined}
          >
            <Gauge className="sidebar-icon" aria-hidden="true" />
            <span>Табло</span>
          </a>
          <a
            className={`sidebar-link${page === "updates" ? "is-active" : ""}`}
            href="/admin/updates"
            aria-current={page === "updates" ? "page" : undefined}
          >
            <RefreshCw className="sidebar-icon" aria-hidden="true" />
            <span>Обновявания</span>
          </a>
        </nav>
        <div className="sidebar-footer">
          <span>Flex CMS</span>
          <strong>v{version}</strong>
        </div>
      </aside>
      <button
        className="sidebar-backdrop"
        type="button"
        aria-label="Затвори страничната лента"
        hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
      />
    </div>
  )
}
