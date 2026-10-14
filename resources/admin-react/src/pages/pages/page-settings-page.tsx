import { t } from "@/lib/admin-i18n"
import { Save } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { Textarea } from "@/components/ui/textarea"
import { useContext, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react"
import { LayoutTemplate, Navigation, Puzzle, Search } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { AdminWorkspaceContext, type PageTemplateOption } from "@/components/admin-workspace-context"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CheckboxField } from "@/components/checkbox-field"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import type { PagePluginField, PageRecord, PageSettings } from "@/lib/admin-types"
import { ExtensionPanels, ExtensionScope, usePanelSaves } from "@/components/extension-page"
import { useFormDirty } from "@/lib/use-form-dirty"

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
  const formRef = useRef<HTMLFormElement>(null)
  const { isDirty, markClean, refresh } = useFormDirty(formRef)
  const templates = useContext(AdminWorkspaceContext)?.themeCapabilities?.page_templates
  const templateOptions: PageTemplateOption[] = templates?.length
    ? templates
    : [
        { id: "default", label: "Стандартен" },
        { id: "full_width", label: "Пълна ширина" },
        { id: "landing", label: "Landing page" },
      ]
  const selectedTemplate =
    templateOptions.find((template) => template.id === settings.template) ?? templateOptions[0]
  const saves = usePanelSaves()
  const panelContext = useMemo(
    () => ({ type: "page", id: page.id, page, settings }),
    [page, settings],
  )

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
      await saves.run({ id: page.id })
      markClean()
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
      title={t("Page settings")}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Страници"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{t("Page settings")}</h1>
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
      <ExtensionScope value={{ context: panelContext, saves }}>
        <form ref={formRef} className="react-page-form" onClickCapture={refresh} onSubmit={save}>
          <input type="hidden" value={JSON.stringify({ settings, pluginSettings })} />
          <CollapsibleSection
            extensionPoint="page.settings.appearance"
            title={t("Page preview")}
            storageKey="page-settings-appearance"
            icon={LayoutTemplate}
          >
            <label>

              {t("Template")}
              <DropdownMenu
                ariaLabel={t("Choose template")}
                triggerClassName="react-form-dropdown"
                trigger={
                  <>
                    <span>{selectedTemplate?.label ? t(selectedTemplate.label) : t("Default setting")}</span>
                    <DropdownChevron />
                  </>
                }
              >
                {templateOptions.map((template) => (
                  <DropdownOption
                    key={template.id}
                    selected={selectedTemplate?.id === template.id}
                    onClick={() => setSettings({ ...settings, template: template.id })}
                  >
                    {t(template.label)}
                  </DropdownOption>
                ))}
              </DropdownMenu>
            </label>
          </CollapsibleSection>
          <CollapsibleSection
            extensionPoint="page.settings.navigation"
            title={t("Navigation")}
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

                {t("Show this page in navigation")}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.use_parent_slugs ?? false}
                  onChange={(event) =>
                    setSettings({ ...settings, use_parent_slugs: event.target.checked })
                  }
                />{" "}

                {t("Include parent page slugs in the URL")}
              </label>
            </div>
            <label className="react-navigation-order-field">

              {t("Navigation position")}
              <input
                type="number"
                min={0}
                value={settings.menu_order ?? 0}
                onChange={(event) =>
                  setSettings({ ...settings, menu_order: Number(event.target.value) })
                }
              />
              <small>{t("Lower numbers appear first.")}</small>
            </label>
          </CollapsibleSection>
          <CollapsibleSection
            extensionPoint="page.settings.indexing"
            title={t("Indexing")}
            storageKey="page-settings-indexing"
            icon={Search}
          >
            <div className="react-checkbox-grid">
              <label>
                <input
                  type="checkbox"
                  checked={settings.no_index ?? false}
                  onChange={(event) => setSettings({ ...settings, no_index: event.target.checked })}
                />{" "}

                {t("Do not index this page")}
              </label>
            </div>
          </CollapsibleSection>
          <ExtensionPanels location="page.settings" context={panelContext} saves={saves} />
          {Object.entries(groupedFields).map(([plugin, fields]) => (
            <CollapsibleSection
              key={plugin}
              title={`Настройки от ${fields[0].plugin_name}`}
              icon={Puzzle}
            >
              <p className="react-plugin-provider">

                {t("Extension")} {fields[0].plugin_name}  {t("· version")} {fields[0].plugin_version}
              </p>
              <div className="react-plugin-fields-inner">
                {fields.map((field) => {
                  const current = pluginSettings[field.plugin]?.[field.id] ?? field.default
                  return field.type === "checkbox" ? (
                    <CheckboxField
                      key={`${field.plugin}.${field.id}`}
                      checked={Boolean(current)}
                      label={field.label}
                      description={field.hint ? t(field.hint) : undefined}
                      onChange={(event) => setPluginSetting(field, event.target.checked)}
                    />
                  ) : (
                    <label key={`${field.plugin}.${field.id}`}>
                      {t(field.label)}
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
                      {field.hint && <small>{t(field.hint)}</small>}
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
              disabled={saving || !isDirty}
            >
              {saving ? t("Saving record…") : t("Save settings")}
            </LoadingButton>
            <button type="button" onClick={onBack}>

              {t("Cancel")}
            </button>
          </div>
        </form>
      </ExtensionScope>
    </AdminShell>
  )
}
