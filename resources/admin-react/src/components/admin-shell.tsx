import type { ReactNode } from "react"
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
    <div className={`admin-shell-react${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
      <AdminSidebar
        onLogout={onLogout}
        onNavigate={onNavigate}
        activeItem={activeItem}
        loggingOut={loggingOut}
        collapsed={sidebarCollapsed}
      />
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
