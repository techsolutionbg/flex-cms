import { AdminShell } from "@/components/layout/AdminShell"
import { DashboardPage } from "@/pages/DashboardPage"
import { UpdatesPage } from "@/pages/UpdatesPage"
import type { AdminBootstrap } from "@/types"

export function App({ bootstrap }: { bootstrap: AdminBootstrap }) {
  return (
    <AdminShell bootstrap={bootstrap}>
      {bootstrap.page === "updates" ? (
        <UpdatesPage bootstrap={bootstrap} />
      ) : (
        <DashboardPage />
      )}
    </AdminShell>
  )
}
