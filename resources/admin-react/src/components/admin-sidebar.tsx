import {
  FileText,
  Images,
  ListTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Puzzle,
  RefreshCw,
  Palette,
  UserRound,
  UsersRound,
  X,
  Settings,
  ShoppingBag,
} from "lucide-react"
import { useContext, useState } from "react"
import { LoadingButton } from "./loading-button"
import { AdminWorkspaceContext } from "./admin-workspace-context"
import { adminUrl } from "@/lib/admin-routes"

type SidebarItem = {
  label: string
  icon: typeof LayoutDashboard
  active?: boolean
}

type SidebarGroup = {
  id: string
  label: string
  items: SidebarItem[]
}

const groups: SidebarGroup[] = [
  { id: "overview", label: "Основни", items: [{ label: "Табло", icon: LayoutDashboard }] },
  {
    id: "content",
    label: "Съдържание",
    items: [
      { label: "Страници", icon: FileText },
      { label: "Медийна библиотека", icon: Images },
    ],
  },
  { id: "appearance", label: "Външен вид", items: [{ label: "Теми", icon: Palette }] },
  { id: "commerce", label: "Магазин", items: [] },
  {
    id: "management",
    label: "Управление",
    items: [
      { label: "Потребители", icon: UsersRound },
      { label: "Разширения", icon: Puzzle },
    ],
  },
  {
    id: "system",
    label: "Система",
    items: [
      { label: "Настройки", icon: Settings },
      { label: "Обновявания", icon: RefreshCw },
    ],
  },
  { id: "extensions", label: "Допълнителни инструменти", items: [] },
  { id: "account", label: "Акаунт", items: [{ label: "Профил", icon: UserRound }] },
]
const extensionIcons: Record<string, typeof Puzzle> = {
  puzzle: Puzzle,
  images: Images,
  "shopping-bag": ShoppingBag,
  "file-text": FileText,
  settings: Settings,
  users: UsersRound,
  palette: Palette,
}

const sidebarPaths: Record<string, string> = {
  Табло: "/",
  Страници: "/pages",
  "Медийна библиотека": "/media",
  Менюта: "/menus",
  Теми: "/themes",
  Потребители: "/users",
  Разширения: "/plugins",
  Обновявания: "/updates",
  Настройки: "/settings",
  Профил: "/profile",
}

export function AdminSidebar({
  onLogout,
  onNavigate,
  activeItem = "Табло",
  loggingOut = false,
  collapsed = false,
}: {
  onLogout: () => void
  onNavigate: (label: string) => void
  activeItem?: string
  loggingOut?: boolean
  collapsed?: boolean
}) {
  const [open, setOpen] = useState(false)
  const workspace = useContext(AdminWorkspaceContext)
  const extensionPages = workspace?.extensionPages ?? []
  const visibleGroups = groups
    .map((group) => {
      const items = [...group.items]
      if (group.id === "appearance" && workspace?.themeCapabilities?.supports.menus) {
        items.unshift({ label: "Менюта", icon: ListTree })
      }
      for (const page of extensionPages) {
        const requested = page.navigation?.group ?? "extensions"
        const groupId = groups.some((entry) => entry.id === requested) ? requested : "extensions"
        if (groupId === group.id)
          items.push({
            label: page.label,
            icon: extensionIcons[page.navigation?.icon ?? "puzzle"] ?? Puzzle,
          })
      }
      return { ...group, items }
    })
    .filter((group) => group.items.length > 0)

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

      {open && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Затвори страничната лента"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar-react${open ? " is-open" : ""}${collapsed ? " is-collapsed" : ""}`}
      >
        <div className="sidebar-brand-react">
          <img src="/assets/brand/logo.png" alt="Flex CMS" />
        </div>

        <nav aria-label="Основна навигация">
          {visibleGroups.map((group) => (
            <div className="sidebar-group-react" key={group.label}>
              <p className="sidebar-group-label-react">{group.label}</p>
              <ul>
                {group.items.map(({ label, icon: Icon }) => (
                  <li key={label}>
                    <a
                      className={`sidebar-link-react${activeItem === label ? " is-active" : ""}`}
                      href={adminUrl(
                        extensionPages.find((page) => page.label === label)?.href ??
                          sidebarPaths[label] ??
                          "/",
                      )}
                      title={label}
                      onClick={(event) => {
                        if (
                          event.button !== 0 ||
                          event.ctrlKey ||
                          event.metaKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return
                        event.preventDefault()
                        navigateFromSidebar(label)
                      }}
                    >
                      <Icon className="sidebar-icon-react" aria-hidden="true" />
                      <span className="sidebar-label-react">{label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <LoadingButton
          className="sidebar-logout-react"
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          loading={loggingOut}
          icon={<LogOut className="sidebar-icon-react" aria-hidden="true" />}
        >
          <span>{loggingOut ? "Излизане…" : "Изход"}</span>
        </LoadingButton>
      </aside>
    </>
  )
}
