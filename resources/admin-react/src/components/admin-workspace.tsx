import { useEffect, useRef, useState } from "react"
import { adminRoute, adminUrl } from "@/lib/admin-routes"
import { isWorkspacePath, readWorkspace, writeWorkspace } from "@/lib/workspace-storage"
import type { PageRecord, PluginRecord, UserRecord } from "@/lib/admin-types"
import { DashboardPage } from "@/pages/dashboard-page"
import { PageForm, PageSettingsForm, PagesPage } from "@/pages/pages"
import { UserForm, UsersPage } from "@/pages/users"
import { ProfilePage } from "@/pages/profile-page"
import { ThemesPage } from "@/pages/themes-page"
import { ThemeStorePage } from "@/pages/theme-store-page"
import { PluginCatalogPage, PluginDetailPage, PluginsPage } from "@/pages/plugins"
import { UpdatesPage } from "@/pages/updates-page"
import { AdminShell } from "./admin-shell"
import { AdminWorkspaceContext } from "./admin-workspace-context"
import type { ThemeCapabilities } from "./admin-workspace-context"
import { MenusPage } from "@/pages/menus-page"
import { MenuEditor } from "@/pages/menu-editor"
import { MenuStructurePage } from "@/pages/menu-structure-page"

type Tab = {
  id: string
  path: string
  title: string
  dirty: boolean
  loading?: boolean
  error?: string
  page?: PageRecord
  user?: UserRecord
  plugin?: PluginRecord
  revision: number
}
const sections: Record<string, string> = {
  "/": "Табло",
  "/pages": "Страници",
  "/menus": "Менюта",
  "/users": "Потребители",
  "/profile": "Профил",
  "/themes": "Теми",
  "/theme-store": "Каталог с теми",
  "/plugins": "Разширения",
  "/plugins/catalog": "Каталог с разширения",
  "/updates": "Обновявания",
}
let sequence = 0

export function AdminWorkspace({
  onLogout,
  loggingOut,
  accountId = 0,
}: {
  onLogout: () => void
  loggingOut: boolean
  accountId?: number
}) {
  const storageKey = `flex-admin-workspace:v1:${adminUrl("/")}:${accountId}`
  const [tabs, setTabs] = useState<Tab[]>([])
  const [active, setActive] = useState("")
  const [themeCapabilities, setThemeCapabilities] = useState<ThemeCapabilities | null>(null)
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null)
  const capabilitiesRequest = useRef(0)
  const tabsRef = useRef(tabs)
  const activeRef = useRef(active)
  const scroll = useRef(new Map<string, number>())
  tabsRef.current = tabs
  activeRef.current = active

  function patch(id: string, changes: Partial<Tab>) {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...changes } : tab)))
  }
  function activate(id: string, history = true) {
    const tab = tabsRef.current.find((item) => item.id === id)
    if (!tab) return
    scroll.current.set(activeRef.current, window.scrollY)
    setActive(id)
    if (history && adminRoute() !== tab.path) window.history.pushState(null, "", adminUrl(tab.path))
    requestAnimationFrame(() => window.scrollTo(0, scroll.current.get(id) ?? 0))
  }
  async function hydrate(tab: Tab) {
    const pageMatch = tab.path.match(/^\/pages\/(\d+)\/(edit|settings)$/)
    const userMatch = tab.path.match(/^\/users\/(\d+)\/edit$/)
    const pluginMatch = tab.path.match(/^\/plugins\/(.+)$/)
    if (!pageMatch && !userMatch && (!pluginMatch || tab.path === "/plugins/catalog")) return
    patch(tab.id, { loading: true, error: undefined })
    try {
      const endpoint = pageMatch
        ? "/api/admin/pages?view=active"
        : userMatch
          ? "/api/users?view=active"
          : "/api/admin/plugins"
      const response = await fetch(endpoint, {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      })
      const body = await response.json()
      if (!response.ok)
        throw new Error(body.error?.message ?? "Страницата не можа да бъде заредена.")
      if (pageMatch) {
        const page = (body.pages as PageRecord[]).find((item) => item.id === Number(pageMatch[1]))
        if (!page) throw new Error("Страницата не е намерена.")
        patch(tab.id, {
          page,
          title: `${pageMatch[2] === "settings" ? "Настройки: " : ""}${page.title}`,
          loading: false,
        })
      } else if (userMatch) {
        const user = (body.users as UserRecord[]).find((item) => item.id === Number(userMatch[1]))
        if (!user) throw new Error("Потребителят не е намерен.")
        patch(tab.id, { user, title: user.email, loading: false })
      } else {
        const plugin = (body.plugins as PluginRecord[]).find(
          (item) => item.id === decodeURIComponent(pluginMatch![1]),
        )
        if (!plugin) throw new Error("Разширението не е инсталирано.")
        patch(tab.id, { plugin, title: plugin.name, loading: false })
      }
    } catch (error) {
      patch(tab.id, {
        loading: false,
        error: error instanceof Error ? error.message : "Грешка при зареждане.",
      })
    }
  }
  function open(path: string, data: Partial<Tab> = {}, history = true) {
    if (!isWorkspacePath(path)) path = "/"
    const existing = tabsRef.current.find((tab) => tab.path === path)
    if (existing) {
      activate(existing.id, history)
      return
    }
    const tab: Tab = {
      id: String(++sequence),
      path,
      title:
        sections[path] ??
        (path === "/pages/create"
          ? "Нова страница"
          : path === "/users/create"
            ? "Нов потребител"
            : path.startsWith("/menus/")
              ? path.endsWith("/structure")
                ? "Структура на менюто"
                : "Меню"
              : "Зареждане…"),
      dirty: false,
      revision: 0,
      ...data,
    }
    const needsData =
      !tab.page &&
      !tab.user &&
      !tab.plugin &&
      /^\/(pages|users)\/\d+\/(edit|settings)$|^\/plugins\/(?!catalog$)/.test(path)
    tab.loading = needsData
    scroll.current.set(activeRef.current, window.scrollY)
    tabsRef.current = [...tabsRef.current, tab]
    setTabs(tabsRef.current)
    setActive(tab.id)
    if (history) window.history.pushState(null, "", adminUrl(path))
    requestAnimationFrame(() => window.scrollTo(0, 0))
    if (needsData) void hydrate(tab)
  }
  function close(id: string) {
    const tab = tabsRef.current.find((item) => item.id === id)
    if (
      !tab ||
      (tab.dirty && !window.confirm(`„${tab.title}“ има незапазени промени. Да затворим ли таба?`))
    )
      return
    const index = tabsRef.current.indexOf(tab)
    const remaining = tabsRef.current.filter((item) => item.id !== id)
    tabsRef.current = remaining
    setTabs(remaining)
    scroll.current.delete(id)
    if (activeRef.current === id) {
      if (remaining.length) activate(remaining[Math.min(index, remaining.length - 1)].id)
      else open("/")
    }
  }
  useEffect(() => {
    const restored = readWorkspace(storageKey)
    restored.paths.forEach((path) => open(path, {}, false))
    const incoming = adminRoute()
    const target = incoming === "/" && restored.active ? restored.active : incoming
    open(target, {}, false)
    if (target !== incoming) window.history.replaceState(null, "", adminUrl(target))
    const back = () => open(adminRoute(), {}, false)
    window.addEventListener("popstate", back)
    const unload = (event: BeforeUnloadEvent) => {
      if (tabsRef.current.some((tab) => tab.dirty)) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", unload)
    return () => {
      window.removeEventListener("popstate", back)
      window.removeEventListener("beforeunload", unload)
    }
  }, [])

  useEffect(() => {
    const selected = tabs.find((tab) => tab.id === active)
    if (selected)
      writeWorkspace(
        storageKey,
        tabs.map((tab) => tab.path),
        selected.path,
      )
  }, [tabs, active, storageKey])

  async function refresh(id: string) {
    const tab = tabsRef.current.find((item) => item.id === id)
    if (
      !tab ||
      tab.loading ||
      (tab.dirty &&
        !window.confirm(
          `Презареждането на „${tab.title}“ ще изтрие незапазените промени. Да продължим ли?`,
        ))
    )
      return
    patch(id, { dirty: false, error: undefined, revision: tab.revision + 1 })
    void loadCapabilities()
    await hydrate(tab)
  }

  async function loadCapabilities() {
    const request = ++capabilitiesRequest.current
    try {
      const response = await fetch("/api/admin/theme-capabilities", {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      })
      const body = await response.json()
      if (!response.ok)
        throw new Error(
          body.error?.message ?? "Възможностите на темата не можаха да бъдат заредени.",
        )
      if (request === capabilitiesRequest.current) {
        setThemeCapabilities(body)
        setCapabilitiesError(null)
      }
    } catch (error) {
      if (request === capabilitiesRequest.current) {
        setThemeCapabilities(null)
        setCapabilitiesError(
          error instanceof Error ? error.message : "Грешка при проверка на темата.",
        )
      }
    }
  }
  useEffect(() => {
    void loadCapabilities()
    const reload = () => {
      void loadCapabilities()
    }
    window.addEventListener("flex-admin-theme-changed", reload)
    window.addEventListener("focus", reload)
    return () => {
      capabilitiesRequest.current++
      window.removeEventListener("flex-admin-theme-changed", reload)
      window.removeEventListener("focus", reload)
    }
  }, [])

  function navigate(label: string) {
    open(Object.entries(sections).find(([, title]) => title === label)?.[0] ?? "/")
  }
  function saved(tab: Tab, data: Partial<Tab> = {}) {
    patch(tab.id, { ...data, dirty: false })
    if (data.path && activeRef.current === tab.id)
      window.history.replaceState(null, "", adminUrl(data.path))
    setTabs((current) =>
      current.map((item) =>
        ["/pages", "/users", "/menus"].includes(item.path) && !item.dirty
          ? { ...item, revision: item.revision + 1 }
          : item,
      ),
    )
  }
  function render(tab: Tab) {
    const common = { onLogout, loggingOut, onNavigate: navigate }
    const editPage = (page: PageRecord) =>
      open(`/pages/${page.id}/edit`, { page, title: page.title })
    const settings = (page: PageRecord) =>
      open(`/pages/${page.id}/settings`, { page, title: `Настройки: ${page.title}` })
    const editUser = (user: UserRecord) =>
      open(`/users/${user.id}/edit`, { user, title: user.email })
    const plugin = (plugin: PluginRecord) =>
      open(`/plugins/${encodeURIComponent(plugin.id)}`, { plugin, title: plugin.name })
    if (tab.loading || tab.error)
      return (
        <AdminShell {...common} title={tab.title}>
          <p role={tab.error ? "alert" : "status"}>{tab.error ?? "Зареждане…"}</p>
          {tab.error && (
            <button className="react-secondary-button" onClick={() => void hydrate(tab)}>
              Опитай отново
            </button>
          )}
        </AdminShell>
      )
    switch (tab.path) {
      case "/menus":
        return (
          <MenusPage
            {...common}
            capabilities={themeCapabilities}
            error={capabilitiesError}
            onCreate={() => open("/menus/create")}
            onEdit={(menu) => open(`/menus/${menu.id}/edit`, { title: menu.name })}
          />
        )
      case "/pages":
        return (
          <PagesPage
            {...common}
            onCreate={() => open("/pages/create")}
            onEdit={editPage}
            onSettings={settings}
          />
        )
      case "/users":
        return <UsersPage {...common} onCreate={() => open("/users/create")} onEdit={editUser} />
      case "/profile":
        return <ProfilePage {...common} />
      case "/themes":
        return <ThemesPage {...common} />
      case "/theme-store":
        return <ThemeStorePage {...common} onBack={() => open("/themes")} />
      case "/plugins":
        return (
          <PluginsPage {...common} onCatalog={() => open("/plugins/catalog")} onView={plugin} />
        )
      case "/plugins/catalog":
        return (
          <PluginCatalogPage
            {...common}
            onBack={() => open("/plugins")}
            onView={(id) => open(`/plugins/${encodeURIComponent(id)}`)}
          />
        )
      case "/updates":
        return <UpdatesPage {...common} />
    }
    const menuStructureMatch = tab.path.match(/^\/menus\/(\d+)\/structure$/)
    if (menuStructureMatch)
      return (
        <MenuStructurePage
          {...common}
          capabilities={themeCapabilities}
          error={capabilitiesError}
          menuId={Number(menuStructureMatch[1])}
        />
      )
    if (/^\/menus\/(create|\d+\/edit)$/.test(tab.path))
      return (
        <MenuEditor
          {...common}
          capabilities={themeCapabilities}
          error={capabilitiesError}
          id={tab.path === "/menus/create" ? null : Number(tab.path.split("/")[2])}
          onBack={() => open("/menus")}
          onSaved={(menu) => saved(tab, { title: menu.name, path: `/menus/${menu.id}/edit` })}
          onStructure={(menuId) => open(`/menus/${menuId}/structure`, { title: "Структура на менюто" })}
        />
      )
    if (/^\/pages\/(create|\d+\/edit)$/.test(tab.path))
      return (
        <PageForm
          {...common}
          page={tab.page ?? null}
          onBack={() => open("/pages")}
          onSettings={settings}
          onSaved={(page) =>
            saved(tab, { page, title: page.title, path: `/pages/${page.id}/edit` })
          }
        />
      )
    if (tab.path.endsWith("/settings") && tab.page)
      return (
        <PageSettingsForm
          {...common}
          page={tab.page}
          onBack={() => open("/pages")}
          onEdit={editPage}
          onSaved={(page) => saved(tab, { page, title: `Настройки: ${page.title}` })}
        />
      )
    if (/^\/users\/(create|\d+\/edit)$/.test(tab.path))
      return (
        <UserForm
          {...common}
          user={tab.user ?? null}
          onBack={() => open("/users")}
          onSaved={(user) =>
            saved(tab, { user, title: user.email, path: `/users/${user.id}/edit` })
          }
        />
      )
    if (tab.plugin)
      return <PluginDetailPage {...common} plugin={tab.plugin} onBack={() => open("/plugins")} />
    return <DashboardPage {...common} onCreatePage={() => open("/pages/create")} />
  }
  return (
    <>
      {tabs.map((tab) => (
        <AdminWorkspaceContext.Provider
          key={tab.id}
          value={{
            tabs,
            active,
            panel: tab.id,
            activate,
            close,
            saved: () => patch(tab.id, { dirty: false }),
            changed: () => patch(tab.id, { dirty: true }),
            refresh: () => void refresh(tab.id),
            refreshing: Boolean(tab.loading),
            themeCapabilities,
            capabilitiesError,
          }}
        >
          <div
            hidden={tab.id !== active}
            role="tabpanel"
            id={`workspace-panel-${tab.id}`}
            aria-labelledby={`workspace-tab-${tab.id}`}
            onClickCapture={(event) => {
              if (
                (event.target as HTMLElement).closest('[role="menuitem"]') &&
                /^\/(pages|users)\/(create|\d+\/)|^\/profile$/.test(tab.path)
              )
                patch(tab.id, { dirty: true })
            }}
            onInputCapture={() => {
              if (/^\/(pages|users)\/(create|\d+\/)|^\/profile$/.test(tab.path))
                patch(tab.id, { dirty: true })
            }}
            onChangeCapture={() => {
              if (/^\/(pages|users)\/(create|\d+\/)|^\/profile$/.test(tab.path))
                patch(tab.id, { dirty: true })
            }}
          >
            <div key={tab.revision}>{render(tab)}</div>
          </div>
        </AdminWorkspaceContext.Provider>
      ))}
    </>
  )
}
