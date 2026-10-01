import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Puzzle,
  RefreshCw,
  UserRound,
  UsersRound,
  X,
} from "lucide-react"
import { useState } from "react"

type SidebarItem = {
  label: string
  icon: typeof LayoutDashboard
  active?: boolean
}

type SidebarGroup = {
  label: string
  items: SidebarItem[]
}

const groups: SidebarGroup[] = [
  {
    label: "Основни",
    items: [
      { label: "Табло", icon: LayoutDashboard, active: true },
      { label: "Страници", icon: FileText },
    ],
  },
  {
    label: "Управление",
    items: [
      { label: "Потребители", icon: UsersRound },
      { label: "Разширения", icon: Puzzle },
    ],
  },
  {
    label: "Система",
    items: [{ label: "Обновявания", icon: RefreshCw }],
  },
  {
    label: "Акаунт",
    items: [{ label: "Профил", icon: UserRound }],
  },
]

export function AdminSidebar({ onLogout, loggingOut = false }: { onLogout: () => void; loggingOut?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="sidebar-mobile-toggle"
        type="button"
        aria-label={open ? "Затвори страничната лента" : "Отвори страничната лента"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={21} /> : <Menu size={21} />}
      </button>

      {open && <button className="sidebar-backdrop" type="button" aria-label="Затвори страничната лента" onClick={() => setOpen(false)} />}

      <aside className={`admin-sidebar-react${open ? " is-open" : ""}`}>
        <div className="sidebar-brand-react">
          <img src="/assets/brand/logo.png" alt="Flex CMS" />
        </div>

        <nav aria-label="Основна навигация">
          {groups.map((group) => (
            <div className="sidebar-group-react" key={group.label}>
              <p className="sidebar-group-label-react">{group.label}</p>
              <ul>
                {group.items.map(({ label, icon: Icon, active }) => (
                  <li key={label}>
                    <a className={`sidebar-link-react${active ? " is-active" : ""}`} href="#" onClick={(event) => event.preventDefault()}>
                      <Icon className="sidebar-icon-react" aria-hidden="true" />
                      <span>{label}</span>
                      {active && <span className="sidebar-active-dot" aria-hidden="true" />}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <button className="sidebar-logout-react" type="button" onClick={onLogout} disabled={loggingOut}>
          <LogOut className="sidebar-icon-react" aria-hidden="true" />
          <span>{loggingOut ? "Излизане…" : "Изход"}</span>
        </button>
      </aside>
    </>
  )
}
