import type { ReactNode } from "react"

import { AdminSidebar } from "@/components/layout/AdminSidebar"
import { AdminTopbar } from "@/components/layout/AdminTopbar"
import type { AdminBootstrap } from "@/types"

export function AdminShell({
  bootstrap,
  children,
  navigating = false,
}: {
  bootstrap: AdminBootstrap
  children: ReactNode
  navigating?: boolean
}) {
  return (
    <div className="admin-shell">
      <AdminSidebar
        page={bootstrap.page}
        version={bootstrap.version}
        initialWidth={bootstrap.sidebarWidth}
        csrfToken={bootstrap.csrfToken}
      />
      <div className="admin-main">
        <AdminTopbar csrfToken={bootstrap.csrfToken} page={bootstrap.page} />
        <main className="admin-content" aria-busy={navigating}>{children}</main>
      </div>
    </div>
  )
}
