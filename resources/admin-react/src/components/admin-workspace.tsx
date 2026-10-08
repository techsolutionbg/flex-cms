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
import { ThemeDetailPage } from "@/pages/theme-detail-page"
import { PluginCatalogPage, PluginDetailPage, PluginsPage } from "@/pages/plugins"
import { UpdatesPage } from "@/pages/updates-page"
import { SettingsPage } from "@/pages/settings-page"
import { AdminShell } from "./admin-shell"
import { ConfirmDialog } from "./confirm-dialog"
import { AdminWorkspaceContext } from "./admin-workspace-context"
import type { ThemeCapabilities } from "./admin-workspace-context"
import { MenusPage } from "@/pages/menus-page"
import { MenuEditor } from "@/pages/menu-editor"
import { MenuStructurePage } from "@/pages/menu-structure-page"
import { MediaPage } from "@/pages/media-page"
import { ExtensionPage, type ExtensionPageDescriptor } from "./extension-page"

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
  "/media": "Медийна библиотека",
  "/media/upload": "Качване на файлове",
  "/menus": "Менюта",
  "/users": "Потребители",
  "/profile": "Профил",
  "/themes": "Теми",
  "/theme-store": "Каталог с теми",
  "/plugins": "Разширения",
  "/plugins/catalog": "Каталог с разширения",
  "/updates": "Обновявания",
  "/settings": "Настройки",
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
  const [confirmCloseAll, setConfirmCloseAll] = useState(false)
  const [extensionPages, setExtensionPages] = useState<ExtensionPageDescriptor[]>([])
  const [extensionsError, setExtensionsError] = useState("")
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
        extensionPages.find((page) => path === page.href || path.startsWith(page.href + "/"))
          ?.label ??
        sections[path] ??
        (path.startsWith("/themes/") ? `Тема: ${path.split("/")[2]}` : undefined) ??
        (path === "/pages/create"
          ? "Нова страница"
          : path === "/users/create"
            ? "Нов потребител"
            : path.startsWith("/menus/")
              ? path.endsWith("/structure")
                ? "Структура на менюто"
                : "Меню"
              : path.startsWith("/media/")
                ? "Медия"
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
  function finishCloseAll() {
    setConfirmCloseAll(false)
    tabsRef.current = []
    activeRef.current = ""
    setTabs([])
    setActive("")
    open("/")
    scroll.current.clear()
  }
  function closeAll() {
    if (tabsRef.current.every((tab) => tab.path === "/" && !tab.dirty)) return
    if (tabsRef.current.some((tab) => tab.dirty)) setConfirmCloseAll(true)
    else finishCloseAll()
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
    void loadExtensions()
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
  async function loadExtensions() {
    try {
      const response = await fetch("/api/admin/extensions", {
        credentials: "include",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error("Интерфейсите на разширенията не можаха да бъдат заредени.")
      const body = await response.json()
      setExtensionPages(body.pages ?? [])
      setExtensionsError("")
    } catch (error) {
      setExtensionsError((error as Error).message)
    }
  }
  useEffect(() => {
    void loadExtensions()
    const reload = () => void loadExtensions()
    window.addEventListener("focus", reload)
    window.addEventListener("flex-admin-plugins-changed", reload)
    return () => {
      window.removeEventListener("focus", reload)
      window.removeEventListener("flex-admin-plugins-changed", reload)
    }
  }, [])
  useEffect(() => {
    setTabs((current) =>
      current.map((tab) => {
        const page = extensionPages.find(
          (page) => tab.path === page.href || tab.path.startsWith(page.href + "/"),
        )
        return page ? { ...tab, title: page.label } : tab
      }),
    )
  }, [extensionPages])
  useEffect(() => {
    void loadCapabilities()
    const reload = () => {
      void loadCapabilities()
    }
    const themesChanged = () => {
      reload()
      setTabs((current) =>
        current.map((tab) =>
          ["/themes", "/theme-store"].includes(tab.path)
            ? { ...tab, revision: tab.revision + 1 }
            : tab,
        ),
      )
    }
    window.addEventListener("flex-admin-theme-changed", themesChanged)
    window.addEventListener("focus", reload)
    return () => {
      capabilitiesRequest.current++
      window.removeEventListener("flex-admin-theme-changed", themesChanged)
      window.removeEventListener("focus", reload)
    }
  }, [])

  function navigate(target: string) {
    if (target.startsWith("/")) {
      open(target)
      return
    }
    const section = Object.entries(sections).find(([, title]) => title === target)?.[0]
    open(section ?? extensionPages.find((page) => page.label === target)?.href ?? "/")
  }
  function saved(tab: Tab, data: Partial<Tab> = {}) {
    patch(tab.id, { ...data, dirty: false })
    if (data.path && activeRef.current === tab.id)
      window.history.replaceState(null, "", adminUrl(data.path))
    setTabs((current) =>
      current.map((item) =>
        ["/pages", "/users", "/menus", "/media"].includes(item.path) && !item.dirty
          ? { ...item, revision: item.revision + 1 }
          : item,
      ),
    )
  }
  function render(tab: Tab) {
    const common = { onLogout, loggingOut, onNavigate: navigate }
    if (tab.path.startsWith("/extension-pages/")) {
      const descriptor = extensionPages.find(
        (page) => tab.path === page.href || tab.path.startsWith(page.href + "/"),
      )
      return descriptor ? (
        <ExtensionPage
          {...common}
          descriptor={descriptor}
          path={tab.path}
          navigate={(path) => open(path)}
        />
      ) : (
        <AdminShell {...common} title="Разширение">
          <p role="status">
            {extensionsError || "Разширението е неактивно или интерфейсът се зарежда."}
          </p>
        </AdminShell>
      )
    }
    if (
      tab.path === "/media" ||
      tab.path === "/media/upload" ||
      /^\/media\/\d+\/edit$/.test(tab.path)
    )
      return (
        <MediaPage
          {...common}
          id={/^\/media\/\d+\/edit$/.test(tab.path) ? Number(tab.path.split("/")[2]) : undefined}
          upload={tab.path === "/media/upload"}
          onUpload={() => open("/media/upload")}
          onOpen={(record) => open(`/media/${record.id}/edit`, { title: record.title })}
          onBack={() => open("/media")}
        />
      )
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
        return (
          <ThemesPage
            {...common}
            onDetails={(id) => open(`/themes/${id}`, { title: `Тема: ${id}` })}
          />
        )
      case "/theme-store":
        return (
          <ThemeStorePage
            {...common}
            onBack={() => open("/themes")}
            onDetails={(id) => open(`/themes/${id}`, { title: `Тема: ${id}` })}
          />
        )
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
      case "/settings":
        return <SettingsPage {...common} />
    }
    const themeMatch = tab.path.match(/^\/themes\/([a-z0-9][a-z0-9._-]*)$/)
    if (themeMatch)
      return <ThemeDetailPage {...common} id={themeMatch[1]} onBack={() => open("/themes")} />
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
          onStructure={(menuId) =>
            open(`/menus/${menuId}/structure`, { title: "Структура на менюто" })
          }
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
            closeAll,
            canCloseAll: tabs.some((item) => item.path !== "/" || item.dirty),
            saved: () => patch(tab.id, { dirty: false }),
            changed: () => patch(tab.id, { dirty: true }),
            refresh: () => void refresh(tab.id),
            refreshing: Boolean(tab.loading),
            themeCapabilities,
            capabilitiesError,
            extensionPages,
          }}
        >
          <div
            hidden={tab.id !== active}
            role="tabpanel"
            id={`workspace-panel-${tab.id}`}
            aria-labelledby={`workspace-tab-${tab.id}`}
            onClickCapture={(event) => {
              if ((event.target as HTMLElement).closest("[data-workspace-transient]")) return
              if (
                (event.target as HTMLElement).closest('[role="menuitem"]') &&
                /^\/(pages|users)\/(create|\d+\/)|^\/profile$/.test(tab.path)
              )
                patch(tab.id, { dirty: true })
            }}
            onInputCapture={(event) => {
              if ((event.target as HTMLElement).closest("[data-workspace-transient]")) return
              if (/^\/(pages|users)\/(create|\d+\/)|^\/profile$/.test(tab.path))
                patch(tab.id, { dirty: true })
            }}
            onChangeCapture={(event) => {
              if ((event.target as HTMLElement).closest("[data-workspace-transient]")) return
              if (/^\/(pages|users)\/(create|\d+\/)|^\/profile$/.test(tab.path))
                patch(tab.id, { dirty: true })
            }}
          >
            <div key={tab.revision}>{render(tab)}</div>
          </div>
        </AdminWorkspaceContext.Provider>
      ))}
      <ConfirmDialog
        open={confirmCloseAll}
        title="Затваряне на всички табове"
        message={`Има незапазени промени в ${tabs.filter((tab) => tab.dirty).length} таба. Ако продължите, те ще бъдат загубени. Панелът ще се върне към таблото.`}
        confirmLabel="Затвори без запазване"
        onCancel={() => setConfirmCloseAll(false)}
        onConfirm={finishCloseAll}
      />
    </>
  )
}
