import {
  ChevronDown,
  FileText,
  Images,
  LayoutGrid,
  ListTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Puzzle,
  Receipt,
  RefreshCw,
  Palette,
  UserRound,
  UsersRound,
  X,
  Settings,
  ShoppingBag,
} from "lucide-react"
import { useContext, useEffect, useState } from "react"
import { LoadingButton } from "./loading-button"
import { AdminWorkspaceContext } from "./admin-workspace-context"
import { adminUrl } from "@/lib/admin-routes"

type SidebarItem = {
  label: string
  icon: typeof LayoutDashboard
  href: string
  section?: string
  order?: number
}

type SidebarGroup = {
  id: string
  label: string
  items: SidebarItem[]
}

const shopSections = [
  { id: "catalog", label: "Каталог", icon: LayoutGrid },
  { id: "sales", label: "Продажби", icon: Receipt },
  { id: "customers", label: "Клиенти", icon: UsersRound },
  { id: "settings", label: "Настройки", icon: Settings },
]

const groups: SidebarGroup[] = [
  { id: "overview", label: "Основни", items: [{ label: "Табло", icon: LayoutDashboard, href: "/" }] },
  {
    id: "content",
    label: "Съдържание",
    items: [
      { label: "Страници", icon: FileText, href: "/pages" },
      { label: "Медийна библиотека", icon: Images, href: "/media" },
    ],
  },
  { id: "appearance", label: "Външен вид", items: [{ label: "Теми", icon: Palette, href: "/themes" }] },
  { id: "commerce", label: "Магазин", items: [] },
  {
    id: "management",
    label: "Управление",
    items: [
      { label: "Потребители", icon: UsersRound, href: "/users" },
      { label: "Разширения", icon: Puzzle, href: "/plugins" },
    ],
  },
  {
    id: "system",
    label: "Система",
    items: [
      { label: "Настройки", icon: Settings, href: "/settings" },
      { label: "Обновявания", icon: RefreshCw, href: "/updates" },
    ],
  },
  { id: "extensions", label: "Допълнителни инструменти", items: [] },
  { id: "account", label: "Акаунт", items: [{ label: "Профил", icon: UserRound, href: "/profile" }] },
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

function itemActive(item: SidebarItem, activeItem: string) {
  if (activeItem === item.href) return true
  return !item.href.startsWith("/extension-pages/") && activeItem === item.label
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try { const stored = JSON.parse(localStorage.getItem("flex-admin-navigation-groups") ?? "{}"); return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {} }
    catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem("flex-admin-navigation-groups", JSON.stringify(expandedGroups)) } catch { /* Storage may be unavailable. */ }
  }, [expandedGroups])
  const [iconRail, setIconRail] = useState(false)
  const workspace = useContext(AdminWorkspaceContext)
  const extensionPages = workspace?.extensionPages ?? []
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1025px)")
    const update = () => setIconRail(collapsed && query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [collapsed])
  const visibleGroups = groups
    .map((group) => {
      const items = [...group.items]
      if (group.id === "appearance" && workspace?.themeCapabilities?.supports.menus) {
        items.unshift({ label: "Менюта", icon: ListTree, href: "/menus" })
      }
      for (const page of extensionPages) {
        const requested = page.navigation?.group ?? "extensions"
        const groupId = groups.some((entry) => entry.id === requested) ? requested : "extensions"
        if (groupId === group.id)
          items.push({
            label: page.label,
            icon: extensionIcons[page.navigation?.icon ?? "puzzle"] ?? Puzzle,
            href: page.href,
            section: page.navigation?.section,
            order: page.navigation?.order ?? 0,
          })
      }
      return { ...group, items }
    })
    .filter((group) => group.items.length > 0)

  useEffect(() => {
    const group = visibleGroups.find((entry) => entry.items.some((item) => itemActive(item, activeItem)))
    const item = group?.items.find((entry) => itemActive(entry, activeItem))
    const sectionKey = group && item?.section ? `${group.id}:${item.section}` : ""
    if (!group) return
    setExpandedGroups((current) => {
      if (current[group.id] && (!sectionKey || current[sectionKey])) return current
      return { ...current, [group.id]: true, ...(sectionKey ? { [sectionKey]: true } : {}) }
    })
  }, [activeItem, extensionPages])

  function navigateFromSidebar(path: string) {
    if (path === "/profile") {
      setOpen(false)
      window.history.pushState(null, "", adminUrl("/profile"))
      window.dispatchEvent(new PopStateEvent("popstate"))
      return
    }

    if (!open) {
      onNavigate(path)
      return
    }

    setOpen(false)
    window.setTimeout(() => onNavigate(path), 180)
  }

  function renderLink(item: SidebarItem) {
    const active = itemActive(item, activeItem)
    const Icon = item.icon
    return (
      <li key={item.href}>
        <a
          className={`sidebar-link-react${active ? " is-active" : ""}`}
          href={adminUrl(item.href)}
          aria-current={active ? "page" : undefined}
          title={item.label}
          onClick={(event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            navigateFromSidebar(item.href)
          }}
        >
          <Icon className="sidebar-icon-react" aria-hidden="true" />
          <span className="sidebar-label-react">{item.label}</span>
        </a>
      </li>
    )
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
          {visibleGroups.map((group) => {
            const expandable = group.id !== "overview" && group.id !== "account"
            const active = group.items.some((item) => itemActive(item, activeItem))
            const expanded = collapsed || expandedGroups[group.id] === true
            const GroupIcon = group.id === "commerce" ? ShoppingBag : group.items[0].icon
            const commerceItems = group.id === "commerce"
              ? [...group.items].sort((left, right) => {
                  const leftSection = shopSections.findIndex((section) => section.id === left.section)
                  const rightSection = shopSections.findIndex((section) => section.id === right.section)
                  const bySection = (leftSection < 0 ? shopSections.length : leftSection) - (rightSection < 0 ? shopSections.length : rightSection)
                  return bySection || (left.order ?? 0) - (right.order ?? 0)
                })
              : group.items
            const sections = group.id === "commerce" && !iconRail
              ? shopSections
                  .map((section) => ({
                    ...section,
                    items: commerceItems.filter((item) => item.section === section.id),
                  }))
                  .filter((section) => section.items.length > 0)
              : []
            const looseItems = sections.length
              ? commerceItems.filter((item) => !sections.some((section) => section.id === item.section))
              : commerceItems
            return (
            <div className="sidebar-group-react" key={group.label}>
              {expandable ? (
                <button type="button" className={"sidebar-group-toggle-react" + (active ? " has-active-child" : "")}
                  aria-expanded={expanded} aria-controls={"sidebar-submenu-" + group.id} title={group.label}
                  onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !expanded }))}>
                  <GroupIcon className="sidebar-icon-react" aria-hidden="true" />
                  <span className="sidebar-label-react">{group.label}</span>
                  <ChevronDown className={"sidebar-group-chevron" + (expanded ? " is-expanded" : "")} size={16} aria-hidden="true" />
                </button>
              ) : <p className="sidebar-group-label-react">{group.label}</p>}
              <div className={"sidebar-submenu-transition" + (!expandable || expanded ? " is-expanded" : "")}
                aria-hidden={expandable && !expanded} inert={expandable && !expanded}>
              <ul id={"sidebar-submenu-" + group.id} className={expandable ? "sidebar-submenu-react" : undefined}>
                {looseItems.map(renderLink)}
                {sections.map((section) => {
                  const sectionKey = group.id + ":" + section.id
                  const sectionExpanded = collapsed || expandedGroups[sectionKey] === true
                  const sectionActive = section.items.some((item) => itemActive(item, activeItem))
                  const SectionIcon = section.icon
                  return (
                    <li key={section.id} className="sidebar-subsection-react">
                      <button
                        type="button"
                        className={"sidebar-subsection-toggle-react" + (sectionActive ? " has-active-child" : "")}
                        aria-expanded={sectionExpanded}
                        aria-controls={"sidebar-submenu-" + sectionKey}
                        onClick={() => setExpandedGroups((current) => ({ ...current, [sectionKey]: !sectionExpanded }))}
                      >
                        <SectionIcon className="sidebar-icon-react" aria-hidden="true" />
                        <span className="sidebar-label-react">{section.label}</span>
                        <ChevronDown className={"sidebar-group-chevron" + (sectionExpanded ? " is-expanded" : "")} size={16} aria-hidden="true" />
                      </button>
                      <div
                        className={"sidebar-submenu-transition" + (sectionExpanded ? " is-expanded" : "")}
                        aria-hidden={!sectionExpanded}
                        inert={!sectionExpanded}
                      >
                        <ul id={"sidebar-submenu-" + sectionKey}>
                          {section.items.map(renderLink)}
                        </ul>
                      </div>
                    </li>
                  )
                })}
              </ul>
              </div>
            </div>
          )})}
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
