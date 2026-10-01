import { useState, type SyntheticEvent } from "react"
import { LayoutTemplate, LoaderCircle, Navigation, Search } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import type { PageRecord, PageSettings } from "@/lib/admin-types"

type PageSettingsFormProps = { page: PageRecord; onBack: () => void; onSaved: (page: PageRecord) => void; onEdit: (page: PageRecord) => void; onLogout: () => void; onNavigate: (label: string) => void; loggingOut: boolean }

export function PageSettingsForm({ page, onBack, onSaved, onEdit, onLogout, onNavigate, loggingOut }: PageSettingsFormProps) {
  const initial = page.settings ?? {}
  const [settings, setSettings] = useState<PageSettings>({ template: "default", menu_order: 0, use_parent_slugs: false, show_in_navigation: true, show_in_sitemap: true, ...initial })
  const [saving, setSaving] = useState(false)

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true)
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", headers: { Accept: "application/json" } })
      const csrf = await csrfResponse.json() as { csrf_token?: string }
      const response = await fetch(`/api/pages/${page.id}/settings`, { method: "PATCH", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrf.csrf_token ?? "" }, body: JSON.stringify(settings) })
      const body = await response.json().catch(() => ({})) as { page?: PageRecord; error?: string | { message?: string } }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : body.error?.message ?? "Настройките не можаха да бъдат запазени.")
      toast.success("Настройките са запазени.")
      if (body.page) onSaved(body.page)
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Настройките не можаха да бъдат запазени.") }
    finally { setSaving(false) }
  }

  return <AdminShell title="Настройки на страница" onLogout={onLogout} onNavigate={onNavigate} activeItem="Страници" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>Настройки на страница</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Страници", onClick: onBack }, { label: page.title, onClick: () => onEdit(page) }, { label: "Настройки" }]} /></div></div>
    <form className="react-page-form" onSubmit={save}>
      <CollapsibleSection title="Визуализация" storageKey="page-settings-appearance" icon={LayoutTemplate}><label>Шаблон<DropdownMenu ariaLabel="Избор на шаблон" triggerClassName="react-form-dropdown" trigger={<><span>{settings.template === "full_width" ? "Пълна ширина" : settings.template === "landing" ? "Landing page" : "Стандартен"}</span><DropdownChevron /></>}><DropdownOption selected={settings.template === "default"} onClick={() => setSettings({ ...settings, template: "default" })}>Стандартен</DropdownOption><DropdownOption selected={settings.template === "full_width"} onClick={() => setSettings({ ...settings, template: "full_width" })}>Пълна ширина</DropdownOption><DropdownOption selected={settings.template === "landing"} onClick={() => setSettings({ ...settings, template: "landing" })}>Landing page</DropdownOption></DropdownMenu></label></CollapsibleSection>
      <CollapsibleSection title="Навигация" storageKey="page-settings-navigation" icon={Navigation}><label>Позиция в навигацията<input type="number" min={0} value={settings.menu_order ?? 0} onChange={(event) => setSettings({ ...settings, menu_order: Number(event.target.value) })} /><small>По-малките числа се показват по-напред.</small></label><div className="react-checkbox-grid"><label><input type="checkbox" checked={settings.show_in_navigation ?? true} onChange={(event) => setSettings({ ...settings, show_in_navigation: event.target.checked })} /> Показвай страницата в навигацията</label><label><input type="checkbox" checked={settings.use_parent_slugs ?? false} onChange={(event) => setSettings({ ...settings, use_parent_slugs: event.target.checked })} /> Използвай slug-овете на родителските страници в URL адреса</label></div></CollapsibleSection>
      <CollapsibleSection title="Индексация" storageKey="page-settings-indexing" icon={Search}><div className="react-checkbox-grid"><label><input type="checkbox" checked={settings.show_in_sitemap ?? true} onChange={(event) => setSettings({ ...settings, show_in_sitemap: event.target.checked })} /> Включи страницата в sitemap-а</label></div></CollapsibleSection>
      <div className="react-form-actions"><button className="react-primary-button" type="submit" disabled={saving}>{saving && <LoaderCircle className="react-button-spinner" />}{saving ? "Записване…" : "Запази настройките"}</button><button type="button" onClick={onBack}>Отказ</button></div>
    </form>
  </AdminShell>
}
