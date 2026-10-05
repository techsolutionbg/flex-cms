import { useEffect, useState, type SyntheticEvent } from "react"
import { LoaderCircle, Palette, Shield, UserRound } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { useWorkspaceSaved } from "@/components/admin-workspace-context"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { getCsrfToken } from "@/lib/admin-api"
import { getAdminTheme, setAdminTheme, type AdminThemeMode } from "@/lib/admin-theme"
import type { UserRecord } from "@/lib/admin-types"

export function ProfilePage({
  onLogout,
  onNavigate,
  loggingOut,
}: {
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
}) {
  const markSaved = useWorkspaceSaved()
  const [user, setUser] = useState<UserRecord | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [theme, setTheme] = useState<AdminThemeMode>(() => getAdminTheme())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me", { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          user?: UserRecord
          error?: { message?: string }
        }
        if (!response.ok || !body.user)
          throw new Error(body.error?.message ?? "Профилът не можа да бъде зареден.")
        if (!cancelled) {
          setUser(body.user)
          setName(body.user.name)
          setEmail(body.user.email)
        }
      })
      .catch((reason) => {
        if (!cancelled)
          toast.error(
            reason instanceof Error ? reason.message : "Профилът не можа да бъде зареден.",
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function changeTheme(value: AdminThemeMode) {
    setTheme(value)
    setAdminTheme(value)
  }

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || saving) return
    if (password !== passwordConfirmation) {
      toast.error("Паролите не съвпадат.")
      return
    }
    setSaving(true)
    try {
      const token = await getCsrfToken()
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          name,
          email,
          role: user.role,
          status: user.status,
          password,
          password_confirmation: passwordConfirmation,
          current_password: currentPassword,
        }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        user?: UserRecord
        error?: { message?: string }
      }
      if (!response.ok || !body.user)
        throw new Error(body.error?.message ?? "Профилът не можа да бъде запазен.")
      setUser(body.user)
      setName(body.user.name)
      setEmail(body.user.email)
      setPassword("")
      setPasswordConfirmation("")
      setCurrentPassword("")
      toast.success("Профилът е запазен.")
      markSaved?.()
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Профилът не можа да бъде запазен.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      title="Профил"
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Профил"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>Настройки на профила</h1>
          <Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Профил" }]} />
        </div>
      </div>
      {loading ? (
        <div className="auth-loading-screen">
          <LoaderCircle className="react-loading-indicator size-6 animate-spin" />
        </div>
      ) : (
        user && (
          <form className="react-user-form" onSubmit={save}>
            <CollapsibleSection
              title="Основна информация"
              icon={UserRound}
              storageKey="profile-information"
            >
              <div className="react-form-grid">
                <label className="react-form-field">
                  <span>
                    Име <b>*</b>
                  </span>
                  <input value={name} onChange={(event) => setName(event.target.value)} required />
                  <small>Името, което ще се показва в административния панел.</small>
                </label>
                <label className="react-form-field">
                  <span>
                    Имейл <b>*</b>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                  <small>Имейл адресът се използва за вход.</small>
                </label>
              </div>
            </CollapsibleSection>
            <CollapsibleSection title="Сигурност" icon={Shield} storageKey="profile-security">
              <div className="react-form-grid">
                <label className="react-form-field">
                  <span>Нова парола</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <small>
                    Оставете празно, ако не искате да променяте паролата. Минимум 12 символа.
                  </small>
                </label>
                <label className="react-form-field">
                  <span>Потвърждение на новата парола</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                  />
                </label>
                <label className="react-form-field">
                  <span>Текуща парола</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                  <small>Не е задължителна за супер администратор.</small>
                </label>
              </div>
            </CollapsibleSection>
            <CollapsibleSection title="Външен вид" icon={Palette} storageKey="profile-appearance">
              <div className="react-form-grid">
                <label className="react-form-field">
                  <span>Тема на панела</span>
                  <DropdownMenu
                    ariaLabel="Избор на тема на панела"
                    triggerClassName="react-form-select"
                    trigger={
                      <>
                        <span>
                          {theme === "system" ? "Системна" : theme === "light" ? "Светла" : "Тъмна"}
                        </span>
                        <DropdownChevron />
                      </>
                    }
                  >
                    <DropdownOption
                      selected={theme === "system"}
                      onClick={() => changeTheme("system")}
                    >
                      Системна
                    </DropdownOption>
                    <DropdownOption
                      selected={theme === "light"}
                      onClick={() => changeTheme("light")}
                    >
                      Светла
                    </DropdownOption>
                    <DropdownOption selected={theme === "dark"} onClick={() => changeTheme("dark")}>
                      Тъмна
                    </DropdownOption>
                  </DropdownMenu>
                  <small>Системната тема следва предпочитанията на операционната система.</small>
                </label>
              </div>
            </CollapsibleSection>
            <div className="react-form-actions">
              <button type="submit" disabled={saving}>
                {saving && <LoaderCircle className="mr-2 inline-block size-4 animate-spin" />}Запази
                промените
              </button>
            </div>
          </form>
        )
      )}
    </AdminShell>
  )
}
