import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { createRoot } from "react-dom/client"
import { Toaster, toast } from "sonner"
import { LoginPage } from "@/pages/login-page"
import { InstallerPage } from "@/pages/installer-page"
import { AdminWorkspace } from "@/components/admin-workspace"
import { adminRedirectTarget, adminRoute, adminUrl } from "@/lib/admin-routes"
import { getAdminTheme, setAdminTheme, loadAdminSettings } from "@/lib/admin-theme"
import "./index.css"
import { installRequestTracking } from "@/lib/request-tracker"
import { GlobalLoadingBar } from "@/components/global-loading-bar"

installRequestTracking()

function App() {
  const installerRoute = window.location.pathname.replace(/\/$/, "").endsWith("/install")
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [accountId, setAccountId] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)

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

  useEffect(() => {
    if (installerRoute) return

    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const response = await nativeFetch(input, init)
      const requestUrl =
        typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url

      if (response.ok && ["/api/plugins/action", "/api/plugins/upload"].includes(requestUrl))
        window.dispatchEvent(new Event("flex-admin-plugins-changed"))

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
          const body = (await response.json().catch(() => ({}))) as {
            user?: { id?: number; role?: string }
          }

          if (response.ok) {
            if (body.user?.role === "super_admin") {
              try {
                await loadAdminSettings()
              } catch (error) {
                if (!cancelled) toast.error((error as Error).message)
              }
            }
            if (!cancelled) {
              setAccountId(body.user?.id ?? 0)
              setAuthenticated(body.user?.role === "super_admin")
            }
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

  if (authenticated && adminRoute() === "/login") {
    window.location.replace(adminRedirectTarget())
    return null
  }
  return (
    <>
      <Toaster position="top-center" closeButton richColors theme="light" />
      {authenticated ? (
        <AdminWorkspace
          onLogout={() => void logout()}
          loggingOut={loggingOut}
          accountId={accountId}
        />
      ) : (
        <LoginPage onAuthenticated={() => window.location.replace(adminRedirectTarget())} />
      )}
    </>
  )
}
createRoot(document.getElementById("root")!).render(
  <>
    <GlobalLoadingBar />
    <App />
  </>,
)
