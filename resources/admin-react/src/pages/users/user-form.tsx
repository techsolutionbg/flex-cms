import { Save } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { useEffect, useRef, useState, type SyntheticEvent } from "react"
import { Mail, Shield, UserRound } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { getCsrfToken } from "@/lib/admin-api"
import type { UserRecord } from "@/lib/admin-types"

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
      title={editing ? "Редактиране на потребител" : "Създаване на потребител"}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Потребители"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{editing ? "Редактиране на потребител" : "Създаване на потребител"}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[
              { label: "Потребители", onClick: onBack },
              { label: editing ? user.name : "Създаване на потребител" },
            ]}
          />
        </div>
      </div>
      <form className="react-user-form" onSubmit={save}>
        <CollapsibleSection
          title="Основна информация"
          icon={UserRound}
          storageKey="user-form-details"
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
            <label className="react-form-field">
              <span>Роля</span>
              <DropdownMenu
                ariaLabel="Избор на роля"
                triggerClassName="react-form-select"
                trigger={
                  <>
                    <span>{roleLabels[role]}</span>
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
                  Потребител
                </DropdownOption>
                <DropdownOption
                  selected={role === "editor"}
                  disabled={isSuperAdmin}
                  onClick={() => {
                    roleChanged.current = true
                    setRole("editor")
                  }}
                >
                  Редактор
                </DropdownOption>
                <DropdownOption
                  selected={role === "admin"}
                  disabled={isSuperAdmin}
                  onClick={() => {
                    roleChanged.current = true
                    setRole("admin")
                  }}
                >
                  Администратор
                </DropdownOption>
                <DropdownOption
                  selected={role === "super_admin"}
                  disabled={isSuperAdmin}
                  onClick={() => {
                    roleChanged.current = true
                    setRole("super_admin")
                  }}
                >
                  Супер администратор
                </DropdownOption>
              </DropdownMenu>
            </label>
            <label className="react-form-field">
              <span>Статус</span>
              <DropdownMenu
                ariaLabel="Избор на статус"
                triggerClassName="react-form-select"
                trigger={
                  <>
                    <span>{status === "active" ? "Активен" : "Деактивиран"}</span>
                    <DropdownChevron />
                  </>
                }
              >
                <DropdownOption
                  selected={status === "active"}
                  disabled={isSuperAdmin}
                  onClick={() => setStatus("active")}
                >
                  Активен
                </DropdownOption>
                <DropdownOption
                  selected={status === "disabled"}
                  disabled={isSuperAdmin}
                  onClick={() => setStatus("disabled")}
                >
                  Деактивиран
                </DropdownOption>
              </DropdownMenu>
            </label>
          </div>
        </CollapsibleSection>
        <CollapsibleSection
          title={editing ? "Смяна на паролата" : "Парола"}
          icon={Shield}
          storageKey={editing ? "user-form-change-password" : "user-form-password"}
        >
          <div className="react-form-grid">
            <label className="react-form-field">
              <span>
                {editing ? "Нова парола" : "Парола"}
                {!editing && <b> *</b>}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required={!editing}
              />
              <small>Паролата трябва да съдържа поне {minimumPassword} символа.</small>
            </label>
            <label className="react-form-field">
              <span>
                {editing ? "Потвърждение на новата парола" : "Потвърждение на паролата"}
                {!editing && <b> *</b>}
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                required={!editing}
              />
            </label>
          </div>
        </CollapsibleSection>
        {!editing && (
          <CollapsibleSection
            title="Потвърждение на имейла"
            icon={Mail}
            storageKey="user-form-confirmation"
          >
            <label className="react-checkbox-field">
              <input
                type="checkbox"
                checked={sendConfirmation}
                onChange={(event) => setSendConfirmation(event.target.checked)}
              />
              <span>Изпрати код за потвърждение на имейла</span>
            </label>
          </CollapsibleSection>
        )}
        <div className="react-form-actions">
          <LoadingButton
            icon={<Save aria-hidden="true" />}
            loading={saving}
            type="submit"
            disabled={saving}
          >
            {editing ? "Запази промените" : "Създай потребител"}
          </LoadingButton>
          <button type="button" onClick={onBack} disabled={saving}>
            Отказ
          </button>
        </div>
      </form>
    </AdminShell>
  )
}
