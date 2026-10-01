import type { ReactNode } from "react"
import { AdminSidebar } from "./admin-sidebar"

type AdminShellProps = {
  children: ReactNode
  title?: string
}

export function AdminShell({ children, title = "Табло" }: AdminShellProps) {
  return (
    <div className="admin-shell-react">
      <AdminSidebar />
      <div className="admin-main-react">
        <header className="admin-topbar-react">
          <span className="admin-topbar-title-react">{title}</span>
          <a href="#" onClick={(event) => event.preventDefault()}>Изход</a>
        </header>
        <main className="admin-content-react">{children}</main>
      </div>
    </div>
  )
}
