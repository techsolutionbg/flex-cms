import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { pageFormSchema, slugifyPageTitle, type PageFormData } from "@/lib/page-validation"
import type { AdminBootstrap, PageRecord } from "@/types"

type PageForm = PageFormData
type FieldErrors = Partial<Record<keyof PageForm, string>>

const emptyForm: PageForm = { title: "", slug: "", content: "", status: "draft" }

function formFromPage(page: PageRecord): PageForm {
  return { title: page.title, slug: slugifyPageTitle(page.title), content: page.content, status: page.status }
}

export function PagesPage({ bootstrap }: { bootstrap: AdminBootstrap }) {
  const [pages, setPages] = useState<PageRecord[]>(bootstrap.pages ?? [])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<PageForm>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  function startCreate(): void {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setFieldErrors({})
  }

  function startEdit(page: PageRecord): void {
    setEditingId(page.id)
    setForm(formFromPage(page))
    setError(null)
    setFieldErrors({})
  }

  async function save(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const parsed = pageFormSchema.safeParse(form)
    if (!parsed.success) {
      const nextErrors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === "string" && field in form && !nextErrors[field as keyof PageForm]) {
          nextErrors[field as keyof PageForm] = issue.message
        }
      }
      setFieldErrors(nextErrors)
      setError("Моля, поправете маркираните полета.")
      return
    }

    setSaving(true)
    setError(null)
    setFieldErrors({})
    try {
      const editing = editingId !== null
      const response = await fetch(editing ? `/api/pages/${editingId}` : "/api/pages", {
        method: editing ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": bootstrap.csrfToken },
        body: JSON.stringify(parsed.data),
      })
      const payload = (await response.json()) as {
        page?: PageRecord
        error?: { message?: string; details?: { fields?: Record<string, string[]> } }
      }
      if (!response.ok || !payload.page) {
        const backendFields = payload.error?.details?.fields ?? {}
        const nextErrors: FieldErrors = {}
        for (const [field, messages] of Object.entries(backendFields)) {
          if (field in form && messages[0]) nextErrors[field as keyof PageForm] = messages[0]
        }
        setFieldErrors(nextErrors)
        throw new Error(payload.error?.message ?? "Неуспешно записване на страницата.")
      }
      setPages((current) => editing
        ? current.map((page) => (page.id === payload.page?.id ? payload.page as PageRecord : page))
        : [payload.page as PageRecord, ...current])
      startCreate()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Неуспешно записване на страницата.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-heading-row">
        <div>
          <h1>Страници</h1>
          <p className="lead">Създавайте и редактирайте страниците на сайта.</p>
        </div>
        <Button type="button" onClick={startCreate}>Нова страница</Button>
      </div>
      {error && <div className="notice error">{error}</div>}
      <section className="content-card">
        <h2>{editingId === null ? "Създаване на страница" : "Редактиране на страница"}</h2>
        <form className="page-form" onSubmit={save}>
          <label>
            Заглавие
            <Input
              value={form.title}
              required
              maxLength={190}
              aria-invalid={fieldErrors.title ? true : undefined}
              onChange={(event) => {
                const title = event.target.value
                setForm({ ...form, title, slug: slugifyPageTitle(title) })
              }}
            />
            {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
          </label>
          <label>
            URL адрес (slug)
            <Input value={form.slug} readOnly aria-invalid={fieldErrors.slug ? true : undefined} />
            {fieldErrors.slug && <span className="field-error">{fieldErrors.slug}</span>}
          </label>
          <label>
            Съдържание
            <textarea value={form.content} rows={10} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          </label>
          <label>
            Статус
            <Select value={form.status} onValueChange={(value) => {
              if (value === "draft" || value === "published") setForm({ ...form, status: value })
            }}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue>{form.status === "published" ? "Публикувана" : "Чернова"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Чернова</SelectItem>
                <SelectItem value="published">Публикувана</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.status && <span className="field-error">{fieldErrors.status}</span>}
          </label>
          <div className="page-form-actions">
            <Button type="submit" disabled={saving}>{saving ? "Записване…" : "Запази страницата"}</Button>
            {editingId !== null && <Button type="button" variant="outline" onClick={startCreate}>Отказ</Button>}
          </div>
        </form>
      </section>
      <section className="content-card">
        <h2>Всички страници</h2>
        {pages.length === 0 ? <p className="muted">Все още няма създадени страници.</p> : (
          <div className="pages-list">
            {pages.map((page) => (
              <article className="page-list-item" key={page.id}>
                <div><h3>{page.title}</h3><p className="muted">/{page.slug}</p></div>
                <div className="page-list-meta">
                  <span className={`page-status page-status-${page.status}`}>{page.status === "published" ? "Публикувана" : "Чернова"}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit(page)}>Редактирай</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

