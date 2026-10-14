import { Save } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { useEffect, useMemo, useState, type SyntheticEvent } from "react"
import { Check, LoaderCircle, Palette, Shield, UserRound } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { useWorkspaceSaved } from "@/components/admin-workspace-context"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { PasswordGenerator } from "@/components/password-generator"
import { PasswordInput } from "@/components/password-input"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { getCsrfToken } from "@/lib/admin-api"
import {
  effectiveAdminTheme,
  getAdminFontFamily,
  getPersonalFont,
  getPersonalTheme,
  savePersonalFont,
  savePersonalTheme,
  setAdminFont,
  setAdminTheme,
  type AdminFontChoice,
  type AdminThemeMode,
} from "@/lib/admin-theme"
import type { UserRecord } from "@/lib/admin-types"
import { ExtensionScope, usePanelSaves } from "@/components/extension-page"
import {
  getAdminLocale,
  getAdminLocales,
  setAdminLocale,
  t,
  useAdminLocale,
} from "@/lib/admin-i18n"

const themeLabels: Record<AdminThemeMode, string> = {
  system: "Системна",
  light: "Светла — класическа",
  "light-ocean": "Светла — океан",
  "light-sand": "Светла — пясък",
  "light-lavender": "Светла — лавандула",
  "light-rose": "Светла — роза",
  "light-sky": "Светла — небе",
  dark: "Тъмна — гора",
  "dark-midnight": "Тъмна — полунощ",
  "dark-graphite": "Тъмна — графит",
  "dark-ocean": "Тъмна — океан",
  "dark-plum": "Тъмна — слива",
  "dark-ember": "Тъмна — жар",
}

const fontLabels: Record<AdminFontChoice, string> = {
  inter: "Inter / стандартен",
  system: "Системен",
  arial: "Arial",
  verdana: "Verdana",
  trebuchet: "Trebuchet MS",
  georgia: "Georgia",
  monospace: "Моноширинен",
}

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
  const [theme, setTheme] = useState<AdminThemeMode>(
    () => getPersonalTheme() ?? effectiveAdminTheme(),
  )
  const [font, setFont] = useState<AdminFontChoice>(() => getPersonalFont() ?? "inter")
  const activeLocale = useAdminLocale()
  const [locale, setLocale] = useState(() => getAdminLocale())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Plugins add sections and fields here through extension points; they save right after this record.
  const saves = usePanelSaves()
  const extensionScope = useMemo(
    () => ({
      context: { type: "profile", id: user?.id ?? null, values: { name, email, theme } },
      saves,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, name, email, theme],
  )

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
          const savedLocale = body.user.admin_locale ?? "en"
          setLocale(savedLocale)
          setAdminLocale(savedLocale)
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

  // Previews the theme; it is kept only after "Запази промените".
  function changeTheme(value: AdminThemeMode) {
    setTheme(value)
    setAdminTheme(value)
  }
  useEffect(() => () => setAdminTheme(effectiveAdminTheme()), [])
  function changeFont(value: AdminFontChoice) {
    setFont(value)
    setAdminFont(value)
  }
  useEffect(() => () => setAdminFont(getPersonalFont() ?? "inter"), [])

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
          admin_locale: locale,
        }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        user?: UserRecord
        error?: { message?: string }
      }
      if (!response.ok || !body.user)
        throw new Error(body.error?.message ?? "Профилът не можа да бъде запазен.")
      setUser(body.user)
      setLocale(body.user.admin_locale ?? locale)
      setAdminLocale(body.user.admin_locale ?? locale)
      setName(body.user.name)
      setEmail(body.user.email)
      setPassword("")
      setPasswordConfirmation("")
      setCurrentPassword("")
      savePersonalTheme(theme)
      savePersonalFont(font)
      await saves.run({ id: body.user.id })
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
      title={t("Profile")}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Профил"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{t("Profile settings")}</h1>
          <Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: t("Profile") }]} />
        </div>
      </div>
      {loading ? (
        <div className="auth-loading-screen">
          <LoaderCircle className="react-loading-indicator size-6 animate-spin" />
        </div>
      ) : (
        user && (
          <ExtensionScope value={extensionScope}>
            <form className="react-user-form" onSubmit={save} data-admin-locale={activeLocale}>
              <CollapsibleSection
                extensionPoint="profile.information"
                title={t("Basic information")}
                icon={UserRound}
                storageKey="profile-information"
              >
                <div className="react-form-grid">
                  <label className="react-form-field">
                    <span>
                      {t("Name")} <b>*</b>
                    </span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                    <small>{t("The name shown in the admin panel.")}</small>
                  </label>
                  <label className="react-form-field">
                    <span>
                      {t("Email")} <b>*</b>
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                    <small>{t("Your email address is used to sign in.")}</small>
                  </label>
                </div>
              </CollapsibleSection>
              <CollapsibleSection
                extensionPoint="profile.security"
                title={t("Security")}
                icon={Shield}
                storageKey="profile-security"
              >
                <div className="react-form-grid">
                  <div className="react-form-field">
                    <label className="react-form-field-label" htmlFor="profile-new-password">
                      {t("New password")}
                    </label>
                    <PasswordInput
                      variant="admin"
                      id="profile-new-password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <small>
                      {t("Leave blank to keep your current password. Minimum 12 characters.")}
                    </small>
                    <PasswordGenerator
                      onGenerate={(generated) => {
                        setPassword(generated)
                        setPasswordConfirmation(generated)
                      }}
                    />
                  </div>
                  <div className="react-form-field">
                    <label className="react-form-field-label" htmlFor="profile-confirm-password">
                      {t("Confirm new password")}
                    </label>
                    <PasswordInput
                      variant="admin"
                      id="profile-confirm-password"
                      autoComplete="new-password"
                      value={passwordConfirmation}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
                    />
                  </div>
                  <div className="react-form-field">
                    <label className="react-form-field-label" htmlFor="profile-current-password">
                      {t("Current password")}
                    </label>
                    <PasswordInput
                      variant="admin"
                      id="profile-current-password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                    <small>{t("Not required for a super administrator.")}</small>
                  </div>
                </div>
              </CollapsibleSection>
              <CollapsibleSection
                extensionPoint="profile.appearance"
                title={t("Appearance")}
                icon={Palette}
                storageKey="profile-appearance"
              >
                <div className="profile-theme-picker">
                  <div className="profile-font-picker">
                    <label className="react-form-field-label" id="profile-locale-label">
                      {t("Admin panel language")}
                    </label>
                    <DropdownMenu
                      ariaLabel={t("Choose panel language")}
                      triggerClassName="react-form-select"
                      trigger={
                        <>
                          <span>{getAdminLocales().find((item) => item.code === locale)?.label ?? locale}</span>
                          <DropdownChevron />
                        </>
                      }
                    >
                      {getAdminLocales().map((item) => (
                        <DropdownOption
                          key={item.code}
                          selected={locale === item.code}
                          onClick={() => {
                            setLocale(item.code)
                            setAdminLocale(item.code)
                          }}
                        >
                          {item.label}
                        </DropdownOption>
                      ))}
                    </DropdownMenu>
                    <small>
                      {t("This language applies only to the admin panel.")}
                    </small>
                  </div>
                  <p className="profile-theme-picker-label">{t("Panel theme")}</p>
                  <div className="profile-theme-options" role="group" aria-label={t("Panel theme")}>
                    {(Object.keys(themeLabels) as AdminThemeMode[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={theme === value}
                        className={`profile-theme-card${theme === value ? " is-selected" : ""}`}
                        data-theme-choice={value}
                        onClick={() => changeTheme(value)}
                      >
                        <span className="profile-theme-preview" aria-hidden="true">
                          <span className="profile-theme-preview-top" />
                          <span className="profile-theme-preview-sidebar" />
                          <span className="profile-theme-preview-content">
                            <span />
                            <span />
                            <i />
                          </span>
                        </span>
                        <span className="profile-theme-card-name">{t(themeLabels[value])}</span>
                        {theme === value && (
                          <span className="profile-theme-selected" aria-label={t("Selected theme")}>
                            <Check size={14} aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <small>
                      {t("Your choice is saved on this device and takes precedence over the theme in Settings → Admin panel. System theme follows your operating system.")}
                  </small>
                  <div className="profile-font-picker">
                    <label className="react-form-field-label" id="profile-font-label">
                      {t("Panel font")}
                    </label>
                    <DropdownMenu
                      ariaLabel={t("Choose panel font")}
                      triggerClassName="react-form-select"
                      trigger={
                        <>
                          <span style={{ fontFamily: getAdminFontFamily(font) }}>
                            {t(fontLabels[font])}
                          </span>
                          <DropdownChevron />
                        </>
                      }
                    >
                      {(Object.keys(fontLabels) as AdminFontChoice[]).map((value) => (
                        <DropdownOption
                          key={value}
                          selected={font === value}
                          onClick={() => changeFont(value)}
                        >
                          <span style={{ fontFamily: getAdminFontFamily(value) }}>
                            {t(fontLabels[value])}
                          </span>
                        </DropdownOption>
                      ))}
                    </DropdownMenu>
                    <span
                      className="profile-font-sample"
                      style={{ fontFamily: getAdminFontFamily(font) }}
                      aria-live="polite"
                    >
                      {t("Preview: Flex CMS — Aa Bb 123")}
                    </span>
                  </div>
                </div>
              </CollapsibleSection>
              <div className="react-form-actions">
                <LoadingButton
                  icon={<Save aria-hidden="true" />}
                  loading={saving}
                  type="submit"
                  disabled={saving}
                >

                  {t("Save changes")}
                </LoadingButton>
              </div>
            </form>
          </ExtensionScope>
        )
      )}
    </AdminShell>
  )
}
