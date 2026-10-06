import { Textarea } from "@/components/ui/textarea"
import { useEffect, useState } from "react"
import { Save, Settings } from "lucide-react"
import { toast } from "sonner"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownMenu, DropdownOption, DropdownChevron } from "@/components/dropdown-menu"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import { useWorkspaceChanged, useWorkspaceSaved } from "@/components/admin-workspace-context"

type Values = {
  name: string
  description: string
  locale: string
  timezone: string
  date_format: string
  time_format: string
}
type Options = {
  locales: Record<string, string>
  timezones: string[]
  date_formats: string[]
  time_formats: string[]
}
export function GeneralSettingsForm() {
  const [values, setValues] = useState<Values | null>(null)
  const [options, setOptions] = useState<Options | null>(null)
  const [failure, setFailure] = useState("")
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const changed = useWorkspaceChanged()
  const saved = useWorkspaceSaved()
  useEffect(() => {
    const abort = new AbortController()
    setFailure("")
    fetch("/api/admin/settings/general", {
      credentials: "include",
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok)
          throw new Error(body.error?.message ?? "Настройките не можаха да бъдат заредени.")
        if (!abort.signal.aborted) {
          setValues(body.settings)
          setOptions(body.options)
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted) setFailure(error.message)
      })
    return () => abort.abort()
  }, [revision])
  function update(key: keyof Values, value: string) {
    setValues((current) => (current ? { ...current, [key]: value } : current))
    changed?.()
  }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (saving || !values) return
    setSaving(true)
    setFailure("")
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/admin/settings/general", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify(values),
        signal: AbortSignal.timeout(20000),
      })
      const body = await response.json()
      if (!response.ok)
        throw new Error(body.error?.message ?? "Настройките не можаха да бъдат записани.")
      setValues(body.settings)
      saved?.()
      toast.success("Общите настройки са запазени.")
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Грешка при записване.")
    } finally {
      setSaving(false)
    }
  }
  const selects: Array<{
    key: keyof Values
    label: string
    choices: Record<string, string>
    hint: string
  }> = options
    ? [
        {
          key: "locale",
          label: "Основен език",
          choices: options.locales,
          hint: "Език на сайта, достъпен за темите. Не превежда автоматично съдържанието.",
        },
        {
          key: "timezone",
          label: "Часова зона",
          choices: Object.fromEntries(options.timezones.map((zone) => [zone, zone])),
          hint: "Използва се при форматиране на датите. Датите в базата остават в UTC.",
        },
        {
          key: "date_format",
          label: "Формат на датата",
          choices: {
            "d.m.Y": "06.10.2026",
            "Y-m-d": "2026-10-06",
            "d/m/Y": "06/10/2026",
            "m/d/Y": "10/06/2026",
          },
          hint: "Предпочитан формат за показване на дата.",
        },
        {
          key: "time_format",
          label: "Формат на часа",
          choices: { "H:i": "14:30", "H:i:s": "14:30:00", "g:i A": "2:30 PM" },
          hint: "24-часов или 12-часов формат.",
        },
      ]
    : []
  return (
    <form onSubmit={(event) => void save(event)}>
      <CollapsibleSection title="Общи" icon={Settings} storageKey="settings:general">
        {failure && (
          <p className="react-error-text" role="alert">
            {failure}
            {!values && (
              <LoadingButton onClick={() => setRevision((value) => value + 1)}>
                Опитай отново
              </LoadingButton>
            )}
          </p>
        )}
        {!values && !failure && <p role="status">Зареждане…</p>}
        {values && (
          <div className="react-form-grid">
            <label className="react-form-field settings-field-wide">
              <span>Име на сайта</span>
              <input
                value={values.name}
                required
                maxLength={150}
                disabled={saving}
                onChange={(event) => update("name", event.target.value)}
              />
              <small>Публично име на сайта. До 150 символа.</small>
            </label>
            <label className="react-form-field settings-field-wide">
              <span>Кратко описание</span>
              <Textarea
                value={values.description}
                maxLength={500}
                rows={3}
                disabled={saving}
                onChange={(event) => update("description", event.target.value)}
              />
              <small>По желание. До 500 символа.</small>
            </label>
            {selects.map(({ key, label, choices, hint }) => (
              <div className="react-form-field" key={key}>
                <span>{label}</span>
                <DropdownMenu
                  ariaLabel={label}
                  triggerClassName="react-form-select"
                  trigger={
                    <>
                      <span>{choices[values[key]] ?? values[key]}</span>
                      <DropdownChevron />
                    </>
                  }
                >
                  {Object.entries(choices).map(([value, label]) => (
                    <DropdownOption
                      key={value}
                      selected={values[key] === value}
                      disabled={saving}
                      onClick={() => update(key, value)}
                    >
                      {label}
                    </DropdownOption>
                  ))}
                </DropdownMenu>
                <small>{hint}</small>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
      {values && (
        <div className="react-form-actions">
          <LoadingButton
            type="submit"
            loading={saving}
            disabled={saving}
            icon={<Save aria-hidden="true" />}
            className="settings-save-button"
          >
            Запази настройките
          </LoadingButton>
        </div>
      )}
    </form>
  )
}
