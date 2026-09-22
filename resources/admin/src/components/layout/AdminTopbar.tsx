import type { AdminBootstrap } from "@/types"

const pageTitles: Record<AdminBootstrap["page"], string> = {
  dashboard: "Табло",
  updates: "Обновявания",
  profile: "Профил",
  pages: "Страници",
}

export function AdminTopbar({
  csrfToken,
  page,
}: {
  csrfToken: string
  page: AdminBootstrap["page"]
}) {
  return (
    <header className="admin-topbar">
      <div className="topbar-title">{pageTitles[page]}</div>
      <div className="topbar-actions">
        <form method="post" action="/logout">
          <input type="hidden" name="_token" value={csrfToken} />
          <button className="logout" type="submit">
            Изход
          </button>
        </form>
      </div>
    </header>
  )
}
