import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { createRoot } from "react-dom/client"
import { Toaster, toast } from "sonner"
import { UserForm, UsersPage as UsersPageComponent } from "@/pages/users"
import { PageForm, PageSettingsForm, PagesPage } from "@/pages/pages"
import { PluginCatalogPage, PluginDetailPage, PluginsPage } from "@/pages/plugins"
import type { PageRecord, PluginRecord, UserRecord } from "@/lib/admin-types"
import { LoginPage } from "@/pages/login-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { UpdatesPage } from "@/pages/updates-page"
import { InstallerPage } from "@/pages/installer-page"
import { ThemesPage } from "@/pages/themes-page"
import { ThemeStorePage } from "@/pages/theme-store-page"
import { ProfilePage } from "@/pages/profile-page"
import { adminRedirectTarget, adminRoute, adminUrl } from "@/lib/admin-routes"
import { getAdminTheme, setAdminTheme } from "@/lib/admin-theme"
import "./index.css"

function App() {
  const installerRoute = window.location.pathname.replace(/\/$/, "").endsWith("/install")
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [pageView, setPageView] = useState<
    | "dashboard"
    | "pages"
    | "users"
    | "themes"
    | "theme-store"
    | "plugins"
    | "plugin-catalog"
    | "plugin-detail"
    | "updates"
    | "profile"
    | "user-form"
    | "form"
    | "settings"
  >("dashboard")
  const [editingPage, setEditingPage] = useState<PageRecord | null>(null)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [pluginDetail, setPluginDetail] = useState<PluginRecord | null>(null)

  useEffect(() => {
    setAdminTheme(getAdminTheme())
    const media = window.matchMedia?.("(prefers-color-scheme: dark)")
    if (!media) return
    const updateSystemTheme = () => {
      if (getAdminTheme() === "system") setAdminTheme("system")
    }
    media.addEventListener?.("change", updateSystemTheme)
    return () => media.removeEventListener?.("change", updateSystemTheme)
  }, [])

  function pushRoute(path: string) {
    window.history.pushState(null, "", adminUrl(path))
  }

  function goToDashboard() {
    pushRoute("/")
    setPageView("dashboard")
  }
  function goToPages() {
    pushRoute("/pages")
    setPageView("pages")
  }
  function goToUsers() {
    pushRoute("/users")
    setPageView("users")
  }
  function goToProfile() {
    pushRoute("/profile")
    setPageView("profile")
  }
  function goToThemes() {
    pushRoute("/themes")
    setPageView("themes")
  }
  function goToThemeStore() {
    pushRoute("/theme-store")
    setPageView("theme-store")
  }
  function goToPlugins() {
    pushRoute("/plugins")
    setPageView("plugins")
  }
  function goToUpdates() {
    pushRoute("/updates")
    setPageView("updates")
  }
  function goToPluginCatalog() {
    pushRoute("/plugins/catalog")
    setPageView("plugin-catalog")
  }
  function goToPluginDetail(plugin: PluginRecord) {
    setPluginDetail(plugin)
    pushRoute(`/plugins/${encodeURIComponent(plugin.id)}`)
    setPageView("plugin-detail")
  }
  async function viewPluginFromCatalog(id: string) {
    try {
      const response = await fetch("/api/admin/plugins", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      const body = (await response.json()) as { plugins?: PluginRecord[] }
      const plugin = (body.plugins ?? []).find((item) => item.id === id)
      if (!response.ok || !plugin) throw new Error("Разширението не е инсталирано.")
      goToPluginDetail(plugin)
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Разширението не можа да бъде заредено.",
      )
    }
  }

  useEffect(() => {
    if (installerRoute) return

    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const response = await nativeFetch(input, init)
      const requestUrl =
        typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url

      if (response.status === 401 && requestUrl.startsWith("/api/") && adminRoute() !== "/login") {
        const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`
        window.location.replace(
          `${adminUrl("/login")}?redirect=${encodeURIComponent(currentRoute)}`,
        )
      }

      return response
    }

    return () => {
      window.fetch = nativeFetch
    }
  }, [installerRoute])

  useEffect(() => {
    if (installerRoute) return
    function syncRoute() {
      const path = adminRoute()
      if (path === "/pages") setPageView("pages")
      else if (path === "/users") setPageView("users")
      else if (path === "/themes") setPageView("themes")
      else if (path === "/theme-store") setPageView("theme-store")
      else if (path === "/plugins") setPageView("plugins")
      else if (path === "/plugins/catalog") setPageView("plugin-catalog")
      else if (path === "/updates") setPageView("updates")
      else if (path === "/profile") setPageView("profile")
      else if (path.startsWith("/plugins/") && path !== "/plugins/catalog")
        setPageView("plugin-detail")
      else if (path === "/users/create") {
        setEditingUser(null)
        setPageView("user-form")
      } else if (/^\/users\/\d+\/edit$/.test(path)) setPageView("user-form")
      else if (path === "/" || path === "") setPageView("dashboard")
    }
    window.addEventListener("popstate", syncRoute)
    return () => window.removeEventListener("popstate", syncRoute)
  }, [installerRoute])

  useEffect(() => {
    if (authenticated !== true) return
    const path = adminRoute()
    if (path === "/login") {
      window.location.replace(adminRedirectTarget())
      return
    }
    if (path === "/pages") {
      setPageView("pages")
      return
    }
    if (path === "/users") {
      setPageView("users")
      return
    }
    if (path === "/themes") {
      setPageView("themes")
      return
    }
    if (path === "/theme-store") {
      setPageView("theme-store")
      return
    }
    if (path === "/plugins") {
      setPageView("plugins")
      return
    }
    if (path === "/plugins/catalog") {
      setPageView("plugin-catalog")
      return
    }
    if (path === "/updates") {
      setPageView("updates")
      return
    }
    if (path === "/profile") {
      setPageView("profile")
      return
    }
    const pluginMatch = path.match(/^\/plugins\/(.+)$/)
    if (pluginMatch) {
      setPageView("plugin-detail")
      fetch("/api/admin/plugins", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          const body = (await response.json()) as { plugins?: PluginRecord[] }
          const selected = (body.plugins ?? []).find(
            (item) => item.id === decodeURIComponent(pluginMatch[1]),
          )
          if (response.ok && selected) setPluginDetail(selected)
          else if (response.ok) toast.error("Разширението не е намерено.")
        })
        .catch(() => toast.error("Разширението не можа да бъде заредено."))
      return
    }
    if (path === "/users/create") {
      setEditingUser(null)
      setPageView("user-form")
      return
    }
    const userMatch = path.match(/^\/users\/(\d+)\/edit$/)
    if (userMatch) {
      setPageView("user-form")
      fetch("/api/users?view=active", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          const body = (await response.json()) as { users?: UserRecord[] }
          const selected = (body.users ?? []).find((item) => item.id === Number(userMatch[1]))
          if (response.ok && selected) setEditingUser(selected)
          else if (response.ok) toast.error("Потребителят не е намерен.")
        })
        .catch(() => toast.error("Потребителят не можа да бъде зареден."))
      return
    }
    if (path === "/pages/create") {
      setEditingPage(null)
      setPageView("form")
      return
    }
    const match = path.match(/^\/pages\/(\d+)\/(edit|settings)$/)
    if (!match) return
    setPageView(match[2] === "settings" ? "settings" : "form")
    fetch("/api/admin/pages?view=active", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as { pages?: PageRecord[] }
        const selected = (body.pages ?? []).find((item) => item.id === Number(match[1]))
        if (response.ok && selected) setEditingPage(selected)
        else if (response.ok) toast.error("Страницата не е намерена.")
      })
      .catch(() => toast.error("Страницата не можа да бъде заредена."))
  }, [authenticated])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      const maxAttempts = 8

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const response = await fetch("/api/auth/me", {
            credentials: "include",
            headers: { Accept: "application/json" },
            cache: "no-store",
          })
          const body = (await response.json().catch(() => ({}))) as { user?: { role?: string } }

          if (response.ok) {
            if (!cancelled) setAuthenticated(body.user?.role === "super_admin")
            return
          }

          // During a platform update the application can briefly return 503
          // while the existing session remains valid. Keep the auth screen
          // loading and retry instead of treating that as a logout.
          if (![502, 503, 504].includes(response.status)) {
            if (!cancelled) setAuthenticated(false)
            return
          }
        } catch {
          // A short connection reset is also expected while the platform
          // switches files. Retry before showing the login screen.
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, Math.min(500 + attempt * 500, 2500)),
          )
        }
      }

      if (!cancelled) {
        setAuthenticated(false)
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      const csrfBody = (await csrfResponse.json().catch(() => ({}))) as { csrf_token?: string }
      if (!csrfResponse.ok || !csrfBody.csrf_token)
        throw new Error("Не може да бъде получен токен за сигурност.")

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "X-CSRF-Token": csrfBody.csrf_token },
      })
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? "Излизането не беше успешно.")

      toast.success("Излязохте успешно.")
      window.location.replace(adminUrl("/login"))
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Излизането не беше успешно.")
    } finally {
      setLoggingOut(false)
    }
  }

  if (installerRoute)
    return (
      <>
        <Toaster position="top-center" closeButton richColors theme="light" />
        <InstallerPage />
      </>
    )

  if (authenticated === null) {
    return (
      <main className="auth-loading-screen" aria-label="Проверка на сесия">
        <LoaderCircle className="react-loading-indicator size-6 animate-spin" />
      </main>
    )
  }

  if (authenticated && pageView === "theme-store") {
    return (
      <>
        <Toaster position="top-center" closeButton richColors theme="light" />
        <ThemeStorePage
          onLogout={() => void logout()}
          onNavigate={(label) =>
            label === "Теми"
              ? goToThemes()
              : label === "Разширения"
                ? goToPlugins()
                : label === "Обновявания"
                  ? goToUpdates()
                  : label === "Страници"
                    ? goToPages()
                    : label === "Потребители"
                      ? goToUsers()
                      : goToDashboard()
          }
          onBack={goToThemes}
          loggingOut={loggingOut}
        />
      </>
    )
  }

  if (authenticated && pageView === "profile") {
    return (
      <>
        <Toaster position="top-center" closeButton richColors theme="light" />
        <ProfilePage
          onLogout={() => void logout()}
          onNavigate={(label) =>
            label === "Страници"
              ? goToPages()
              : label === "Теми"
                ? goToThemes()
                : label === "Потребители"
                  ? goToUsers()
                  : label === "Разширения"
                    ? goToPlugins()
                    : label === "Обновявания"
                      ? goToUpdates()
                      : goToDashboard()
          }
          loggingOut={loggingOut}
        />
      </>
    )
  }

  return (
    <>
      <Toaster position="top-center" closeButton richColors theme="light" />
      {authenticated ? (
        pageView === "themes" ? (
          <ThemesPage
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Разширения"
                      ? goToPlugins()
                      : label === "Обновявания"
                        ? goToUpdates()
                        : goToDashboard()
            }
            loggingOut={loggingOut}
          />
        ) : pageView === "updates" ? (
          <UpdatesPage
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Разширения"
                      ? goToPlugins()
                      : label === "Обновявания"
                        ? goToUpdates()
                        : goToDashboard()
            }
            loggingOut={loggingOut}
          />
        ) : pageView === "user-form" ? (
          <UserForm
            user={editingUser}
            onBack={goToUsers}
            onSaved={(savedUser) => {
              setEditingUser(savedUser)
              pushRoute(`/users/${savedUser.id}/edit`)
              setPageView("user-form")
            }}
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Разширения"
                      ? goToPlugins()
                      : label === "Обновявания"
                        ? goToUpdates()
                        : goToDashboard()
            }
            loggingOut={loggingOut}
          />
        ) : pageView === "plugin-detail" && pluginDetail ? (
          <PluginDetailPage
            plugin={pluginDetail}
            onBack={goToPlugins}
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Разширения"
                      ? goToPlugins()
                      : label === "Обновявания"
                        ? goToUpdates()
                        : goToDashboard()
            }
            loggingOut={loggingOut}
          />
        ) : pageView === "form" ? (
          <PageForm
            page={editingPage}
            onBack={goToPages}
            onSaved={(savedPage) => {
              setEditingPage(savedPage)
              pushRoute(`/pages/${savedPage.id}/edit`)
              setPageView("form")
            }}
            onSettings={(selected) => {
              setEditingPage(selected)
              pushRoute(`/pages/${selected.id}/settings`)
              setPageView("settings")
            }}
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Разширения"
                      ? goToPlugins()
                      : label === "Обновявания"
                        ? goToUpdates()
                        : goToDashboard()
            }
            loggingOut={loggingOut}
          />
        ) : pageView === "settings" && editingPage ? (
          <PageSettingsForm
            page={editingPage}
            onBack={goToPages}
            onSaved={(savedPage) => {
              setEditingPage(savedPage)
              pushRoute(`/pages/${savedPage.id}/settings`)
              setPageView("settings")
            }}
            onEdit={(selected) => {
              setEditingPage(selected)
              pushRoute(`/pages/${selected.id}/edit`)
              setPageView("form")
            }}
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Разширения"
                      ? goToPlugins()
                      : label === "Обновявания"
                        ? goToUpdates()
                        : goToDashboard()
            }
            loggingOut={loggingOut}
          />
        ) : pageView === "pages" ? (
          <PagesPage
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Разширения"
                      ? goToPlugins()
                      : label === "Обновявания"
                        ? goToUpdates()
                        : goToDashboard()
            }
            onCreate={() => {
              setEditingPage(null)
              pushRoute("/pages/create")
              setPageView("form")
            }}
            onEdit={(selected) => {
              setEditingPage(selected)
              pushRoute(`/pages/${selected.id}/edit`)
              setPageView("form")
            }}
            onSettings={(selected) => {
              setEditingPage(selected)
              pushRoute(`/pages/${selected.id}/settings`)
              setPageView("settings")
            }}
            loggingOut={loggingOut}
          />
        ) : pageView === "users" ? (
          <UsersPageComponent
            onCreate={() => {
              setEditingUser(null)
              pushRoute("/users/create")
              setPageView("user-form")
            }}
            onEdit={(selected) => {
              setEditingUser(selected)
              pushRoute(`/users/${selected.id}/edit`)
              setPageView("user-form")
            }}
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Разширения"
                    ? goToPlugins()
                    : label === "Обновявания"
                      ? goToUpdates()
                      : goToDashboard()
            }
            loggingOut={loggingOut}
          />
        ) : pageView === "plugin-catalog" ? (
          <PluginCatalogPage
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Обновявания"
                      ? goToUpdates()
                      : goToDashboard()
            }
            onBack={goToPlugins}
            onView={viewPluginFromCatalog}
            loggingOut={loggingOut}
          />
        ) : pageView === "plugins" ? (
          <PluginsPage
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Разширения"
                      ? goToPlugins()
                      : label === "Обновявания"
                        ? goToUpdates()
                        : goToDashboard()
            }
            onCatalog={goToPluginCatalog}
            onView={goToPluginDetail}
            loggingOut={loggingOut}
          />
        ) : (
          <DashboardPage
            onLogout={() => void logout()}
            onNavigate={(label) =>
              label === "Страници"
                ? goToPages()
                : label === "Теми"
                  ? goToThemes()
                  : label === "Потребители"
                    ? goToUsers()
                    : label === "Разширения"
                      ? goToPlugins()
                      : label === "Обновявания"
                        ? goToUpdates()
                        : goToDashboard()
            }
            loggingOut={loggingOut}
          />
        )
      ) : (
        <LoginPage
          onAuthenticated={() => {
            setAuthenticated(true)
            window.location.replace(adminRedirectTarget())
          }}
        />
      )}
    </>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
