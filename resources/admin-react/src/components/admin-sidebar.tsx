import {
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Puzzle,
  RefreshCw,
  Palette,
  UserRound,
  UsersRound,
  X,
} from "lucide-react"
import { useState } from "react"
import { adminUrl } from "@/lib/admin-routes"

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
      { label: "Теми", icon: Palette },
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

export function AdminSidebar({ onLogout, onNavigate, activeItem = "Табло", loggingOut = false, collapsed = false }: { onLogout: () => void; onNavigate: (label: string) => void; activeItem?: string; loggingOut?: boolean; collapsed?: boolean }) {
  const [open, setOpen] = useState(false)

  function navigateFromSidebar(label: string) {
    if (label === "Профил") {
      setOpen(false)
      window.history.pushState(null, "", adminUrl("/profile"))
      window.dispatchEvent(new PopStateEvent("popstate"))
      return
    }

    if (!open) {
      onNavigate(label)
      return
    }

    setOpen(false)
    window.setTimeout(() => onNavigate(label), 180)
  }

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

      <aside className={`admin-sidebar-react${open ? " is-open" : ""}${collapsed ? " is-collapsed" : ""}`}>
        <div className="sidebar-brand-react">
          <img src="/assets/brand/logo.png" alt="Flex CMS" />
        </div>

        <nav aria-label="Основна навигация">
          {groups.map((group) => (
            <div className="sidebar-group-react" key={group.label}>
              <p className="sidebar-group-label-react">{group.label}</p>
              <ul>
      {group.items.map(({ label, icon: Icon }) => (
                  <li key={label}>
                    <a className={`sidebar-link-react${activeItem === label ? " is-active" : ""}`} href={`#${label.toLowerCase()}`} title={collapsed ? label : undefined} onClick={(event) => { event.preventDefault(); navigateFromSidebar(label); }}>
                      <Icon className="sidebar-icon-react" aria-hidden="true" />
                      <span className="sidebar-label-react">{label}</span>
                      {activeItem === label && <span className="sidebar-active-dot" aria-hidden="true" />}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <button className="sidebar-logout-react" type="button" onClick={onLogout} disabled={loggingOut}>
          <LogOut className="sidebar-icon-react" aria-hidden="true" />
          {loggingOut && <LoaderCircle className="react-button-spinner" />}<span>{loggingOut ? "Излизане…" : "Изход"}</span>
        </button>
      </aside>
    </>
  )
}
