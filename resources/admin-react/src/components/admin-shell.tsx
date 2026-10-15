import type { CSSProperties, ReactNode } from "react"
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw } from "lucide-react"
import { LoadingButton } from "./loading-button"
import { useContext, useEffect, useState } from "react"
import { AdminSidebar } from "./admin-sidebar"
import { AdminWorkspaceContext, AdminWorkspaceTabs } from "./admin-workspace-context"
import { PageHelpButton, PageHelpProvider, usePageHelpRegistry } from "./page-help"
import { AdminPanelSearch } from "./admin-panel-search"
import { t } from "@/lib/admin-i18n"
import { Tooltip } from "./ui/tooltip"

type AdminShellProps = {
  children: ReactNode
  title?: string
  onLogout: () => void
  onNavigate: (label: string) => void
  activeItem?: string
  loggingOut?: boolean
}

export function AdminShell({
  children,
  title = "Табло",
  onLogout,
  onNavigate,
  activeItem,
  loggingOut,
}: AdminShellProps) {
  const workspace = useContext(AdminWorkspaceContext)
  const help = usePageHelpRegistry()
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const stored = Number(window.localStorage.getItem("flex-admin-sidebar-width"))
      return stored ? Math.max(220, Math.min(400, stored)) : 248
    } catch {
      return 248
    }
  })
  const [resizing, setResizing] = useState(false)
  function changeWidth(width: number) {
    const next = Math.round(Math.max(220, Math.min(400, window.innerWidth * 0.35, width)))
    setSidebarWidth(next)
    try {
      window.localStorage.setItem("flex-admin-sidebar-width", String(next))
    } catch {
      // Keep resizing available when local storage is restricted.
    }
  }
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("flex-admin-sidebar-collapsed") === "true"
    } catch {
      return false
    }
  })
  const [largeScreen, setLargeScreen] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1025px)").matches,
  )
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      return window.localStorage.getItem("flex-admin-sidebar-hidden") === "true"
    } catch {
      return false
    }
  })
  const sidebarIsCollapsed = sidebarCollapsed && !largeScreen

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1025px)")
    const update = () => setLargeScreen(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current
      try {
        window.localStorage.setItem("flex-admin-sidebar-collapsed", String(next))
      } catch {
        // Ignore storage restrictions; the sidebar still works for this session.
      }
      return next
    })
  }

  function toggleSidebarVisibility() {
    setSidebarHidden((current) => {
      const next = !current
      try {
        window.localStorage.setItem("flex-admin-sidebar-hidden", String(next))
      } catch {
        // Keep the visibility toggle available when local storage is restricted.
      }
      return next
    })
  }

  return (
    <div
      className={`admin-shell-react${sidebarIsCollapsed ? " is-sidebar-collapsed" : ""}${sidebarHidden ? " is-sidebar-hidden" : ""}${resizing ? " is-sidebar-resizing" : ""}`}
      style={{ "--sidebar-expanded-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <AdminSidebar
        onLogout={onLogout}
        onNavigate={onNavigate}
        activeItem={activeItem}
        loggingOut={loggingOut}
        collapsed={sidebarIsCollapsed}
      />
      {!sidebarIsCollapsed && !sidebarHidden && (
        <div
          className="sidebar-resize-handle"
          role="separator"
          aria-label={t("Resize sidebar")}
          aria-orientation="vertical"
          aria-valuemin={220}
          aria-valuemax={400}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.button !== 0 || !window.matchMedia("(min-width: 1025px)").matches) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            setResizing(true)
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) changeWidth(event.clientX)
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId)
            setResizing(false)
          }}
          onPointerCancel={() => setResizing(false)}
          onLostPointerCapture={() => setResizing(false)}
          onDoubleClick={() => changeWidth(248)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault()
              changeWidth(sidebarWidth + (event.key === "ArrowLeft" ? -10 : 10))
            } else if (event.key === "Home") {
              event.preventDefault()
              changeWidth(248)
            }
          }}
        />
      )}
      <div className="admin-main-react">
        <header className="admin-topbar-react">
          <div className="admin-topbar-start">
            <button
              className="react-sidebar-collapse-toggle"
              type="button"
              aria-label={t(sidebarIsCollapsed ? "Разгъни страничната лента" : "Свий страничната лента")}
              aria-expanded={!sidebarIsCollapsed}
              onClick={toggleSidebar}
            >
              <Menu size={21} aria-hidden="true" />
            </button>
            <button
              className="react-sidebar-collapse-toggle react-sidebar-visibility-toggle"
              type="button"
              aria-label={t(sidebarHidden ? "Show sidebar" : "Hide sidebar")}
              title={t(sidebarHidden ? "Show sidebar" : "Hide sidebar")}
              aria-controls="admin-sidebar"
              aria-expanded={!sidebarHidden}
              onClick={toggleSidebarVisibility}
            >
              {sidebarHidden ? (
                <PanelLeftOpen size={21} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={21} aria-hidden="true" />
              )}
            </button>
            <h1 className="admin-topbar-title-react">{t(title)}</h1>
          </div>
          <AdminPanelSearch />
          <div className="admin-topbar-end">
            <PageHelpButton entries={help.entries} />
            {workspace && (
              <Tooltip content="Refresh">
                <LoadingButton
                  className="admin-page-refresh admin-icon-button"
                  type="button"
                  aria-label={t("Refresh")}
                  disabled={workspace.refreshing}
                  loading={workspace.refreshing}
                  icon={<RefreshCw size={18} aria-hidden="true" />}
                  onClick={workspace.refresh}
                >
                  {null}
                </LoadingButton>
              </Tooltip>
            )}
            <Tooltip content={loggingOut ? "Signing out…" : "Log out"}>
              <LoadingButton
                className="admin-logout-react admin-icon-button"
                type="button"
                aria-label={t(loggingOut ? "Signing out…" : "Log out")}
                onClick={onLogout}
                disabled={loggingOut}
                loading={loggingOut}
                icon={<LogOut size={18} aria-hidden="true" />}
              >
                {null}
              </LoadingButton>
            </Tooltip>
          </div>
        </header>
        <AdminWorkspaceTabs />
        <main className="admin-content-react">
          <PageHelpProvider registry={help.registry}>{children}</PageHelpProvider>
        </main>
      </div>
    </div>
  )
}
