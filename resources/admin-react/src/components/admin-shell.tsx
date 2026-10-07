import type { CSSProperties, ReactNode } from "react"
import { Menu, RefreshCw } from "lucide-react"
import { LoadingButton } from "./loading-button"
import { useContext, useState } from "react"
import { AdminSidebar } from "./admin-sidebar"
import { AdminWorkspaceContext, AdminWorkspaceTabs } from "./admin-workspace-context"

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

  return (
    <div
      className={`admin-shell-react${sidebarCollapsed ? " is-sidebar-collapsed" : ""}${resizing ? " is-sidebar-resizing" : ""}`}
      style={{ "--sidebar-expanded-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <AdminSidebar
        onLogout={onLogout}
        onNavigate={onNavigate}
        activeItem={activeItem}
        loggingOut={loggingOut}
        collapsed={sidebarCollapsed}
      />
      {!sidebarCollapsed && (
        <div
          className="sidebar-resize-handle"
          role="separator"
          aria-label="Промени ширината на страничната лента"
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
          <button
            className="react-sidebar-collapse-toggle"
            type="button"
            aria-label={sidebarCollapsed ? "Разгъни страничната лента" : "Свий страничната лента"}
            aria-expanded={!sidebarCollapsed}
            onClick={toggleSidebar}
          >
            <Menu size={21} aria-hidden="true" />
          </button>
          <span className="admin-topbar-title-react">{title}</span>
          {workspace && (
            <LoadingButton
              className="admin-page-refresh"
              type="button"
              aria-label="Презареди данните в страницата"
              title="Презареди данните в страницата"
              disabled={workspace.refreshing}
              loading={workspace.refreshing}
              icon={<RefreshCw size={18} aria-hidden="true" />}
              onClick={workspace.refresh}
            >
              <span>Презареди</span>
            </LoadingButton>
          )}
          <LoadingButton
            className="admin-logout-react"
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            loading={loggingOut}
          >
            {loggingOut ? "Излизане…" : "Изход"}
          </LoadingButton>
        </header>
        <AdminWorkspaceTabs />
        <main className="admin-content-react">{children}</main>
      </div>
    </div>
  )
}
