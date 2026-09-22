import { FileText, Gauge, PanelLeft, RefreshCw, UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import type { AdminBootstrap } from "@/types"

const MIN_WIDTH = 180
const MAX_WIDTH = 420
const MOBILE_QUERY = "(max-width: 48rem)"

function matchesMobileQuery(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches
}

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
  const [isMobile, setIsMobile] = useState(matchesMobileQuery)
  const dragging = useRef(false)

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`)
  }, [width])

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const media = window.matchMedia(MOBILE_QUERY)
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener("change", sync)
    window.addEventListener("resize", sync)
    return () => {
      media.removeEventListener("change", sync)
      window.removeEventListener("resize", sync)
    }
  }, [])

  useEffect(() => {
    document.body.classList.add("sidebar-enhanced")
    document.body.classList.toggle("sidebar-collapsed", !isMobile && collapsed)
    document.body.classList.toggle("sidebar-mobile-open", isMobile && mobileOpen)
    return () => {
      document.body.classList.remove("sidebar-enhanced", "sidebar-collapsed", "sidebar-mobile-open")
    }
  }, [collapsed, isMobile, mobileOpen])

  function toggle(): void {
    if (isMobile) {
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

  const expanded = isMobile ? mobileOpen : !collapsed
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
          <ul className="sidebar-nav-list">
            {[
              {
                id: "dashboard" as const,
                href: "/admin",
                label: "Табло",
                icon: Gauge,
              },
              {
                id: "updates" as const,
                href: "/admin/updates",
                label: "Обновявания",
                icon: RefreshCw,
              },
              {
                id: "pages" as const,
                href: "/admin/pages",
                label: "Страници",
                icon: FileText,
              },
              {
                id: "profile" as const,
                href: "/admin/profile",
                label: "Профил",
                icon: UserRound,
              },
            ].map((item) => {
              const active = page === item.id
              const Icon = item.icon

              return (
                <li key={item.id}>
                  <a
                    className={cn("sidebar-link", active && "is-active")}
                    data-active={active || undefined}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      if (isMobile) setMobileOpen(false)
                    }}
                  >
                    <span className="sidebar-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="sidebar-link-label">{item.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
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
