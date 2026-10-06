import { Save } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useState, type SyntheticEvent } from "react"
import { LayoutTemplate, Navigation, Puzzle, Search } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CheckboxField } from "@/components/checkbox-field"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import type { PagePluginField, PageRecord, PageSettings } from "@/lib/admin-types"

type PageSettingsFormProps = {
  page: PageRecord
  onBack: () => void
  onSaved: (page: PageRecord) => void
  onEdit: (page: PageRecord) => void
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
}

export function PageSettingsForm({
  page,
  onBack,
  onSaved,
  onEdit,
  onLogout,
  onNavigate,
  loggingOut,
}: PageSettingsFormProps) {
  const initial = page.settings ?? {}
  const [settings, setSettings] = useState<PageSettings>({
    template: "default",
    menu_order: 0,
    use_parent_slugs: false,
    show_in_navigation: true,
    ...initial,
  })
  const [pageSettingsFields, setPageSettingsFields] = useState<PagePluginField[]>([])
  const [pluginSettings, setPluginSettings] = useState<
    Record<string, Record<string, string | boolean>>
  >(page.plugin_settings ?? {})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPluginSettings(page.plugin_settings ?? {})
    fetch("/api/admin/pages?view=active", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as { page_settings_fields?: PagePluginField[] }
        if (response.ok) setPageSettingsFields(body.page_settings_fields ?? [])
      })
      .catch(() => toast.error("Полетата от разширенията не можаха да бъдат заредени."))
  }, [page])

  function setPluginSetting(field: PagePluginField, value: string | boolean) {
    setPluginSettings((current) => ({
      ...current,
      [field.plugin]: { ...(current[field.plugin] ?? {}), [field.id]: value },
    }))
  }

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      const csrf = (await csrfResponse.json()) as { csrf_token?: string }
      const response = await fetch(`/api/pages/${page.id}/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf.csrf_token ?? "",
        },
        body: JSON.stringify({ ...settings, plugin_settings: pluginSettings }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        page?: PageRecord
        error?: string | { message?: string }
      }
      if (!response.ok)
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : (body.error?.message ?? "Настройките не можаха да бъдат запазени."),
        )
      toast.success("Настройките са запазени.")
      if (body.page) onSaved({ ...body.page, plugin_settings: pluginSettings })
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Настройките не можаха да бъдат запазени.",
      )
    } finally {
      setSaving(false)
    }
  }

  const groupedFields = pageSettingsFields.reduce<Record<string, PagePluginField[]>>(
    (groups, field) => {
      ;(groups[field.plugin] ??= []).push(field)
      return groups
    },
    {},
  )

  return (
    <AdminShell
      title="Настройки на страница"
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Страници"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>Настройки на страница</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[
              { label: "Страници", onClick: onBack },
              { label: page.title, onClick: () => onEdit(page) },
              { label: "Настройки" },
            ]}
          />
        </div>
      </div>
      <form className="react-page-form" onSubmit={save}>
        <CollapsibleSection
          title="Визуализация"
          storageKey="page-settings-appearance"
          icon={LayoutTemplate}
        >
          <label>
            Шаблон
            <DropdownMenu
              ariaLabel="Избор на шаблон"
              triggerClassName="react-form-dropdown"
              trigger={
                <>
                  <span>
                    {settings.template === "full_width"
                      ? "Пълна ширина"
                      : settings.template === "landing"
                        ? "Landing page"
                        : "Стандартен"}
                  </span>
                  <DropdownChevron />
                </>
              }
            >
              <DropdownOption
                selected={settings.template === "default"}
                onClick={() => setSettings({ ...settings, template: "default" })}
              >
                Стандартен
              </DropdownOption>
              <DropdownOption
                selected={settings.template === "full_width"}
                onClick={() => setSettings({ ...settings, template: "full_width" })}
              >
                Пълна ширина
              </DropdownOption>
              <DropdownOption
                selected={settings.template === "landing"}
                onClick={() => setSettings({ ...settings, template: "landing" })}
              >
                Landing page
              </DropdownOption>
            </DropdownMenu>
          </label>
        </CollapsibleSection>
        <CollapsibleSection
          title="Навигация"
          storageKey="page-settings-navigation"
          icon={Navigation}
        >
          <div className="react-checkbox-grid">
            <label>
              <input
                type="checkbox"
                checked={settings.show_in_navigation ?? true}
                onChange={(event) =>
                  setSettings({ ...settings, show_in_navigation: event.target.checked })
                }
              />{" "}
              Показвай страницата в навигацията
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.use_parent_slugs ?? false}
                onChange={(event) =>
                  setSettings({ ...settings, use_parent_slugs: event.target.checked })
                }
              />{" "}
              Използвай slug-овете на родителските страници в URL адреса
            </label>
          </div>
          <label className="react-navigation-order-field">
            Позиция в навигацията
            <input
              type="number"
              min={0}
              value={settings.menu_order ?? 0}
              onChange={(event) =>
                setSettings({ ...settings, menu_order: Number(event.target.value) })
              }
            />
            <small>По-малките числа се показват по-напред.</small>
          </label>
        </CollapsibleSection>
        <CollapsibleSection title="Индексация" storageKey="page-settings-indexing" icon={Search}>
          <div className="react-checkbox-grid">
            <label>
              <input
                type="checkbox"
                checked={settings.no_index ?? false}
                onChange={(event) => setSettings({ ...settings, no_index: event.target.checked })}
              />{" "}
              Не индексирай страницата
            </label>
          </div>
        </CollapsibleSection>
        {Object.entries(groupedFields).map(([plugin, fields]) => (
          <CollapsibleSection
            key={plugin}
            title={`Настройки от ${fields[0].plugin_name}`}
            icon={Puzzle}
          >
            <p className="react-plugin-provider">
              Разширение {fields[0].plugin_name} · версия {fields[0].plugin_version}
            </p>
            <div className="react-plugin-fields-inner">
              {fields.map((field) => {
                const current = pluginSettings[field.plugin]?.[field.id] ?? field.default
                return field.type === "checkbox" ? (
                  <CheckboxField
                    key={`${field.plugin}.${field.id}`}
                    checked={Boolean(current)}
                    label={field.label}
                    description={field.hint}
                    onChange={(event) => setPluginSetting(field, event.target.checked)}
                  />
                ) : (
                  <label key={`${field.plugin}.${field.id}`}>
                    {field.label}
                    {field.type === "textarea" ? (
                      <Textarea
                        value={String(current ?? "")}
                        maxLength={field.max_length ?? 10000}
                        onChange={(event) => setPluginSetting(field, event.target.value)}
                      />
                    ) : (
                      <input
                        value={String(current ?? "")}
                        maxLength={field.max_length}
                        onChange={(event) => setPluginSetting(field, event.target.value)}
                      />
                    )}
                    {field.hint && <small>{field.hint}</small>}
                  </label>
                )
              })}
            </div>
          </CollapsibleSection>
        ))}
        <div className="react-form-actions">
          <LoadingButton
            icon={<Save aria-hidden="true" />}
            loading={saving}
            className="react-primary-button"
            type="submit"
            disabled={saving}
          >
            {saving ? "Записване…" : "Запази настройките"}
          </LoadingButton>
          <button type="button" onClick={onBack}>
            Отказ
          </button>
        </div>
      </form>
    </AdminShell>
  )
}
