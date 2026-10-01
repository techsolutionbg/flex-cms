import type { ReactNode } from "react"
import { AdminSidebar } from "./admin-sidebar"

type AdminShellProps = {
  children: ReactNode
  title?: string
  onLogout: () => void
  loggingOut?: boolean
}

export function AdminShell({ children, title = "Табло", onLogout, loggingOut }: AdminShellProps) {
  return (
    <div className="admin-shell-react">
      <AdminSidebar onLogout={onLogout} loggingOut={loggingOut} />
      <div className="admin-main-react">
        <header className="admin-topbar-react">
          <span className="admin-topbar-title-react">{title}</span>
          <button className="admin-logout-react" type="button" onClick={onLogout} disabled={loggingOut}>{loggingOut ? "Излизане…" : "Изход"}</button>
        </header>
        <main className="admin-content-react">{children}</main>
      </div>
    </div>
  )
}
