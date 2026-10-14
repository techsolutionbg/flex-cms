import { t } from "@/lib/admin-i18n"
import { Save } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react"
import { Mail, Shield, UserRound } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { PasswordGenerator } from "@/components/password-generator"
import { PasswordInput } from "@/components/password-input"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { getCsrfToken } from "@/lib/admin-api"
import type { UserRecord } from "@/lib/admin-types"
import { useFormDirty } from "@/lib/use-form-dirty"
import { ExtensionScope, usePanelSaves } from "@/components/extension-page"

const roleLabels: Record<string, string> = {
  user: "Потребител",
  editor: "Редактор",
  admin: "Администратор",
  super_admin: "Супер администратор",
}

export function UserForm({
  user,
  onBack,
  onSaved,
  onLogout,
  onNavigate,
  loggingOut,
}: {
  user: UserRecord | null
  onBack: () => void
  onSaved: (user: UserRecord) => void
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
}) {
  const editing = user !== null
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [role, setRole] = useState(user?.role ?? "user")
  const [status, setStatus] = useState(user?.status ?? "active")
  const isSuperAdmin = user?.role === "super_admin"
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [sendConfirmation, setSendConfirmation] = useState(!editing)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const { isDirty, markClean, refresh } = useFormDirty(formRef)
  // Plugins add sections and fields here through extension points; they save right after this record.
  const saves = usePanelSaves()
  const extensionScope = useMemo(
    () => ({
      context: { type: "user", id: user?.id ?? null, values: { name, email, role, status } },
      saves,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, name, email, role, status],
  )
  const roleChanged = useRef(false)
  const [minimumPassword, setMinimumPassword] = useState(12)
  useEffect(() => {
    const abort = new AbortController()
    fetch("/api/admin/settings/users", {
      credentials: "include",
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Правилата за потребители не могат да бъдат заредени.")
        const body = await response.json()
        if (abort.signal.aborted) return
        setMinimumPassword(Number(body.settings.password_min_length))
        if (!editing && !roleChanged.current) setRole(body.settings.default_role)
      })
      .catch((error) => {
        if (!abort.signal.aborted) toast.error(error.message)
      })
    return () => abort.abort()
  }, [editing])

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== passwordConfirmation) {
      toast.error("Паролите не съвпадат.")
      return
    }
    setSaving(true)
    try {
      const token = await getCsrfToken()
      const response = await fetch(editing ? `/api/users/${user.id}` : "/api/users", {
        method: editing ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          name,
          email,
          role,
          status,
          password,
          password_confirmation: passwordConfirmation,
          send_confirmation: sendConfirmation,
        }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        user?: UserRecord
        error?: { message?: string }
      }
      if (!response.ok || !body.user)
        throw new Error(body.error?.message ?? "Потребителят не можа да бъде записан.")
      await saves.run({ id: body.user.id })
      markClean()
      toast.success(editing ? "Потребителят е променен." : "Потребителят е създаден.")
      onSaved(body.user)
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Потребителят не можа да бъде записан.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      title={editing ? t("Edit user") : t("Create user")}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Потребители"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{editing ? t("Edit user") : t("Create user")}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[
              { label: "Потребители", onClick: onBack },
              { label: editing ? user.name : "Създаване на потребител" },
            ]}
          />
        </div>
      </div>
      <ExtensionScope value={extensionScope}>
        <form ref={formRef} className="react-user-form" onClickCapture={refresh} onSubmit={save}>
          <input type="hidden" value={JSON.stringify({ name, email, role, status, password, passwordConfirmation, sendConfirmation })} />
          <CollapsibleSection
            extensionPoint="user.editor.details"
            title={t("Basic information")}
            icon={UserRound}
            storageKey="user-form-details"
          >
            <div className="react-form-grid">
              <label className="react-form-field">
                <span>

                  {t("Name")} <b>*</b>
                </span>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
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
              <label className="react-form-field">
                <span>{t("Role")}</span>
                <DropdownMenu
                  ariaLabel={t("Choose role")}
                  triggerClassName="react-form-select"
                  trigger={
                    <>
                      <span>{t(roleLabels[role])}</span>
                      <DropdownChevron />
                    </>
                  }
                >
                  <DropdownOption
                    selected={role === "user"}
                    disabled={isSuperAdmin}
                    onClick={() => {
                      roleChanged.current = true
                      setRole("user")
                    }}
                  >

                    {t("User")}
                  </DropdownOption>
                  <DropdownOption
                    selected={role === "editor"}
                    disabled={isSuperAdmin}
                    onClick={() => {
                      roleChanged.current = true
                      setRole("editor")
                    }}
                  >

                    {t("Editor")}
                  </DropdownOption>
                  <DropdownOption
                    selected={role === "admin"}
                    disabled={isSuperAdmin}
                    onClick={() => {
                      roleChanged.current = true
                      setRole("admin")
                    }}
                  >

                    {t("Administrator")}
                  </DropdownOption>
                  <DropdownOption
                    selected={role === "super_admin"}
                    disabled={isSuperAdmin}
                    onClick={() => {
                      roleChanged.current = true
                      setRole("super_admin")
                    }}
                  >

                    {t("Super administrator")}
                  </DropdownOption>
                </DropdownMenu>
              </label>
              <label className="react-form-field">
                <span>{t("Status")}</span>
                <DropdownMenu
                  ariaLabel={t("Choose status")}
                  triggerClassName="react-form-select"
                  trigger={
                    <>
                      <span>{status === "active" ? t("Active user") : t("Deactivated")}</span>
                      <DropdownChevron />
                    </>
                  }
                >
                  <DropdownOption
                    selected={status === "active"}
                    disabled={isSuperAdmin}
                    onClick={() => setStatus("active")}
                  >

                    {t("Active user")}
                  </DropdownOption>
                  <DropdownOption
                    selected={status === "disabled"}
                    disabled={isSuperAdmin}
                    onClick={() => setStatus("disabled")}
                  >

                    {t("Deactivated")}
                  </DropdownOption>
                </DropdownMenu>
              </label>
            </div>
          </CollapsibleSection>
          <CollapsibleSection
            extensionPoint="user.editor.password"
            title={editing ? t("Change password") : t("Password")}
            icon={Shield}
            storageKey={editing ? "user-form-change-password" : "user-form-password"}
          >
            <div className="react-form-grid">
              <div className="react-form-field">
                <label className="react-form-field-label" htmlFor="user-form-password">
                  {editing ? t("New password") : t("Password")}
                  {!editing && <b> *</b>}
                </label>
                <PasswordInput
                  variant="admin"
                  id="user-form-password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required={!editing}
                />
                <small>{t("Password must contain at least")} {minimumPassword}  {t("characters.")}</small>
                <PasswordGenerator
                  length={Math.max(24, minimumPassword)}
                  disabled={saving}
                  onGenerate={(generated) => {
                    setPassword(generated)
                    setPasswordConfirmation(generated)
                  }}
                />
              </div>
              <div className="react-form-field">
                <label className="react-form-field-label" htmlFor="user-form-password-confirmation">
                  {editing ? t("Confirm new password") : t("Confirm password label")}
                  {!editing && <b> *</b>}
                </label>
                <PasswordInput
                  variant="admin"
                  id="user-form-password-confirmation"
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  required={!editing}
                />
              </div>
            </div>
          </CollapsibleSection>
          {!editing && (
            <CollapsibleSection
              extensionPoint="user.editor.confirmation"
              title={t("Email verification")}
              icon={Mail}
              storageKey="user-form-confirmation"
            >
              <label className="react-checkbox-field">
                <input
                  type="checkbox"
                  checked={sendConfirmation}
                  onChange={(event) => setSendConfirmation(event.target.checked)}
                />
                <span>{t("Send email verification code")}</span>
              </label>
            </CollapsibleSection>
          )}
          <div className="react-form-actions">
            <LoadingButton
              icon={<Save aria-hidden="true" />}
              loading={saving}
              type="submit"
              disabled={saving || !isDirty}
            >
              {editing ? t("Save changes") : t("Create user action")}
            </LoadingButton>
            <button type="button" onClick={onBack} disabled={saving}>

              {t("Cancel")}
            </button>
          </div>
        </form>
      </ExtensionScope>
    </AdminShell>
  )
}
