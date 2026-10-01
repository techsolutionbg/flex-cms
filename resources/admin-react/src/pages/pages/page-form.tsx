import { useEffect, useState, type SyntheticEvent } from "react"
import { CircleAlert, FileText, FolderTree, LoaderCircle, Puzzle, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { RichTextEditor } from "@/components/rich-text-editor"
import type { PagePluginField, PageRecord } from "@/lib/admin-types"

type PageFormProps = { page: PageRecord | null; onBack: () => void; onSaved: (page: PageRecord) => void; onSettings: (page: PageRecord) => void; onLogout: () => void; onNavigate: (label: string) => void; loggingOut: boolean }

export function PageForm({ page, onBack, onSaved, onSettings, onLogout, onNavigate, loggingOut }: PageFormProps) {
  const [title, setTitle] = useState(page?.title ?? "")
  const [slug, setSlug] = useState(page?.slug ?? "")
  const [content, setContent] = useState(page?.content ?? "")
  const [status, setStatus] = useState(page?.status ?? "draft")
  const [parentId, setParentId] = useState<number | null>(page?.parent_id ?? null)
  const [parents, setParents] = useState<PageRecord[]>([])
  const [pageFields, setPageFields] = useState<PagePluginField[]>([])
  const [pluginFields, setPluginFields] = useState<Record<string, Record<string, string | boolean>>>(page?.plugin_fields ?? {})
  const [slugEdited, setSlugEdited] = useState(Boolean(page))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setTitle(page?.title ?? "")
    setSlug(page?.slug ?? "")
    setContent(page?.content ?? "")
    setStatus(page?.status ?? "draft")
    setParentId(page?.parent_id ?? null)
    setSlugEdited(Boolean(page))
    setPluginFields(page?.plugin_fields ?? {})
  }, [page])

  useEffect(() => {
    fetch("/api/admin/pages?view=active", { credentials: "include", headers: { Accept: "application/json" } }).then(async (response) => {
      const body = await response.json() as { pages?: PageRecord[]; page_fields?: PagePluginField[] }
      if (response.ok) {
        setParents((body.pages ?? []).filter((item) => item.id !== page?.id))
        setPageFields(body.page_fields ?? [])
      }
    }).catch(() => toast.error("Родителските страници не можаха да бъдат заредени."))
  }, [page])

  function slugify(value: string) { return value.toLocaleLowerCase("bg").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") }
  function setPluginField(field: PagePluginField, value: string | boolean) { setPluginFields((current) => ({ ...current, [field.plugin]: { ...(current[field.plugin] ?? {}), [field.id]: value } })) }
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("")
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", headers: { Accept: "application/json" } })
      const csrf = await csrfResponse.json() as { csrf_token?: string }
      const response = await fetch(page ? `/api/pages/${page.id}` : "/api/pages", { method: page ? "PATCH" : "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrf.csrf_token ?? "" }, body: JSON.stringify({ title, slug, content, status, parent_id: parentId, plugin_fields: pluginFields }) })
      const body = await response.json().catch(() => ({})) as { page?: PageRecord; error?: string | { message?: string } }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : body.error?.message ?? "Страницата не можа да бъде запазена.")
      toast.success(page ? "Страницата е обновена." : "Страницата е създадена.")
      if (body.page) onSaved({ ...body.page, plugin_fields: pluginFields })
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Страницата не можа да бъде запазена."; setError(message); toast.error(message) }
    finally { setSaving(false) }
  }

  const groupedFields = pageFields.reduce<Record<string, PagePluginField[]>>((groups, field) => { (groups[field.plugin] ??= []).push(field); return groups }, {})
  return <AdminShell title={page ? "Редактиране на страница" : "Създаване на страница"} onLogout={onLogout} onNavigate={onNavigate} activeItem="Страници" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>{page ? "Редактиране на страница" : "Създаване на страница"}</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={page ? [{ label: "Страници", onClick: onBack }, { label: page.title }] : [{ label: "Страници", onClick: onBack }, { label: "Създаване на страница" }]} /></div>{page && <button type="button" onClick={() => onSettings(page)}>Настройки</button>}</div>
    {error && <div className="react-form-error" role="alert"><CircleAlert />{error}</div>}
    <form className="react-page-form" onSubmit={save}>
      <CollapsibleSection title="Основна информация" icon={FolderTree}><div className="react-form-grid"><label>Заглавие *<input value={title} maxLength={190} onChange={(event) => { setTitle(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)) }} required /></label><label>URL адрес (slug) *<input value={slug} maxLength={190} onChange={(event) => { setSlug(event.target.value); setSlugEdited(true) }} required /></label><label>Родителска страница<DropdownMenu ariaLabel="Избор на родителска страница" triggerClassName="react-form-dropdown" trigger={<><span>{parentId ? parents.find((item) => item.id === parentId)?.title ?? "Избери страница" : "Няма родителска страница"}</span><DropdownChevron /></>}><DropdownOption selected={!parentId} onClick={() => setParentId(null)}>Няма родителска страница</DropdownOption>{parents.map((item) => <DropdownOption key={item.id} selected={parentId === item.id} onClick={() => setParentId(item.id)}>{item.title}</DropdownOption>)}</DropdownMenu></label></div></CollapsibleSection>
      <CollapsibleSection title="Съдържание" icon={FileText}><label>Съдържание<RichTextEditor value={content} onChange={setContent} /></label></CollapsibleSection>
      {Object.entries(groupedFields).map(([plugin, fields]) => <CollapsibleSection key={plugin} title={`Полета от ${fields[0].plugin_name}`} icon={Puzzle}><p className="react-plugin-provider">Разширение {fields[0].plugin_name} · версия {fields[0].plugin_version}</p><div className="react-plugin-fields-inner">{fields.map((field) => { const current = pluginFields[field.plugin]?.[field.id] ?? field.default; return field.type === "checkbox" ? <label className="react-checkbox-field" key={`${field.plugin}.${field.id}`}><input type="checkbox" checked={Boolean(current)} onChange={(event) => setPluginField(field, event.target.checked)} /><span>{field.label}</span>{field.hint && <small>{field.hint}</small>}</label> : <label key={`${field.plugin}.${field.id}`}>{field.label}{field.type === "textarea" ? <textarea value={String(current ?? "")} maxLength={field.max_length ?? 10000} onChange={(event) => setPluginField(field, event.target.value)} /> : <input value={String(current ?? "")} maxLength={field.max_length} onChange={(event) => setPluginField(field, event.target.value)} />}{field.hint && <small>{field.hint}</small>}</label> })}</div></CollapsibleSection>)}
      <CollapsibleSection title="Публикуване" icon={Settings2}><label>Статус<DropdownMenu ariaLabel="Избор на статус" triggerClassName="react-form-dropdown" trigger={<><span>{status === "published" ? "Публикувана" : "Чернова"}</span><DropdownChevron /></>}><DropdownOption selected={status === "draft"} onClick={() => setStatus("draft")}>Чернова</DropdownOption><DropdownOption selected={status === "published"} onClick={() => setStatus("published")}>Публикувана</DropdownOption></DropdownMenu></label></CollapsibleSection>
      <div className="react-form-actions"><button className="react-primary-button" type="submit" disabled={saving}>{saving && <LoaderCircle className="react-button-spinner" />}{saving ? "Записване…" : "Запази страницата"}</button><button type="button" onClick={onBack}>Отказ</button></div>
    </form>
  </AdminShell>
}
