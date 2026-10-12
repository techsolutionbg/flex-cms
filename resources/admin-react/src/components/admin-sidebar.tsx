import {
  ChevronDown,
  FileText,
  Images,
  LayoutGrid,
  ListTree,
  LayoutDashboard,
  Folder,
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
import { BrandLogo } from "./brand-logo"

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
  order: number
  icon?: typeof LayoutDashboard
}

const shopSections = [
  { id: "catalog", label: "Каталог", icon: LayoutGrid },
  { id: "sales", label: "Продажби", icon: Receipt },
  { id: "customers", label: "Клиенти", icon: UsersRound },
  { id: "settings", label: "Настройки", icon: Settings },
]

const groups: SidebarGroup[] = [
  { id: "overview", label: "Основни", order: 10, items: [{ label: "Табло", icon: LayoutDashboard, href: "/" }] },
  {
    id: "content",
    label: "Съдържание",
    order: 20,
    items: [
      { label: "Страници", icon: FileText, href: "/pages" },
      { label: "Медийна библиотека", icon: Images, href: "/media" },
    ],
  },
  { id: "appearance", label: "Външен вид", order: 30, items: [{ label: "Теми", icon: Palette, href: "/themes" }] },
  { id: "commerce", label: "Магазин", order: 40, items: [] },
  {
    id: "management",
    label: "Управление",
    order: 50,
    items: [
      { label: "Потребители", icon: UsersRound, href: "/users" },
      { label: "Разширения", icon: Puzzle, href: "/plugins" },
    ],
  },
  {
    id: "system",
    label: "Система",
    order: 60,
    items: [
      { label: "Настройки", icon: Settings, href: "/settings/general" },
      { label: "Обновявания", icon: RefreshCw, href: "/updates" },
    ],
  },
  { id: "extensions", label: "Допълнителни инструменти", order: 70, items: [] },
  { id: "account", label: "Акаунт", order: 80, items: [{ label: "Профил", icon: UserRound, href: "/profile" }] },
]
const extensionIcons: Record<string, typeof Puzzle> = {
  puzzle: Puzzle,
  images: Images,
  "shopping-bag": ShoppingBag,
  "file-text": FileText,
  settings: Settings,
  users: UsersRound,
  palette: Palette,
  "layout-dashboard": LayoutDashboard,
  "layout-grid": LayoutGrid,
  "list-tree": ListTree,
  folder: Folder,
  "refresh-cw": RefreshCw,
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
  const themeNavigation = workspace?.themeCapabilities?.admin_navigation
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1025px)")
    const update = () => setIconRail(collapsed && query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [collapsed])
  const themeGroups = (themeNavigation?.groups ?? []).map((group) => ({
    id: group.id,
    label: group.label,
    order: group.order,
    icon: extensionIcons[group.icon] ?? LayoutGrid,
    items: [] as SidebarItem[],
  }))
  const knownGroups = [...groups, ...themeGroups]
  const visibleGroups = knownGroups
    .map((group) => {
      const items = group.items.map((item, index) => ({ ...item, order: item.order ?? (index + 1) * 10 }))
      if (group.id === "appearance" && workspace?.themeCapabilities?.supports.menus) {
        items.unshift({ label: "Менюта", icon: ListTree, href: "/menus", order: 0 })
      }
      for (const page of extensionPages) {
        if (page.navigation?.hidden) continue
        const requested = page.navigation?.group ?? "extensions"
        const groupId = knownGroups.some((entry) => entry.id === requested) ? requested : "extensions"
        if (groupId === group.id)
          items.push({
            label: page.label,
            icon: extensionIcons[page.navigation?.icon ?? "puzzle"] ?? Puzzle,
            href: page.href,
            section: page.navigation?.section,
            order: page.navigation?.order ?? 50,
          })
      }
      for (const item of themeNavigation?.items ?? []) {
        if (item.group !== group.id || item.href === "") continue
        items.push({
          label: item.label,
          icon: extensionIcons[item.icon] ?? Puzzle,
          href: item.href,
          section: item.section || undefined,
          order: item.order,
        })
      }
      items.sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      return { ...group, items }
    })
    .filter((group) => group.items.length > 0)
    .sort((left, right) => left.order - right.order)

  useEffect(() => {
    const group = visibleGroups.find((entry) => entry.items.some((item) => itemActive(item, activeItem)))
    const item = group?.items.find((entry) => itemActive(entry, activeItem))
    const sectionKey = group && item?.section ? `${group.id}:${item.section}` : ""
    if (!group) return
    setExpandedGroups((current) => {
      if (current[group.id] && (!sectionKey || current[sectionKey])) return current
      return { ...current, [group.id]: true, ...(sectionKey ? { [sectionKey]: true } : {}) }
    })
  }, [activeItem, extensionPages, themeNavigation])

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
          <BrandLogo />
        </div>

        <nav aria-label="Основна навигация">
          {visibleGroups.map((group) => {
            const expandable = group.id !== "overview" && group.id !== "account"
            const active = group.items.some((item) => itemActive(item, activeItem))
            const expanded = collapsed || expandedGroups[group.id] === true
            const GroupIcon = group.icon ?? (group.id === "commerce" ? ShoppingBag : group.items[0].icon)
            const themeSections = (themeNavigation?.sections ?? [])
              .filter((section) => section.group === group.id)
              .map((section) => ({
                id: section.id,
                label: section.label,
                icon: extensionIcons[section.icon] ?? LayoutGrid,
                order: section.order,
              }))
            const sectionDefs = [
              ...(group.id === "commerce"
                ? shopSections.map((section, index) => ({ ...section, order: (index + 1) * 10 }))
                : []),
              ...themeSections,
            ].sort((left, right) => left.order - right.order)
            const sections = !iconRail
              ? sectionDefs
                  .map((section) => ({
                    ...section,
                    items: group.items.filter((item) => item.section === section.id),
                  }))
                  .filter((section) => section.items.length > 0)
              : []
            const looseItems = sections.length
              ? group.items.filter((item) => !sections.some((section) => section.id === item.section))
              : group.items
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
