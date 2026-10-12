import { CircleAlert, FileText } from "lucide-react"
import { useEffect, useState, type SyntheticEvent } from "react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { ImageField } from "@/components/image-field"
import { LoadingButton } from "@/components/loading-button"
import { useWorkspaceChanged, useWorkspaceSaved } from "@/components/admin-workspace-context"
import type { ThemeResourceDefinition } from "@/components/admin-workspace-context"
import { themeResourceRequest, type ThemeRecordItem } from "./api"

function slugify(value: string) {
  return value
    .toLocaleLowerCase("bg")
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
}

export function ThemeResourceForm({
  resource,
  recordId,
  onLogout,
  onNavigate,
  onBack,
  onSaved,
  loggingOut,
}: {
  resource: ThemeResourceDefinition
  recordId: number | null
  onLogout: () => void
  onNavigate: (label: string) => void
  onBack: () => void
  onSaved: (record: ThemeRecordItem) => void
  loggingOut: boolean
}) {
  const changed = useWorkspaceChanged()
  const saved = useWorkspaceSaved()
  const singular = resource.singular
  const [loading, setLoading] = useState(recordId !== null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [summary, setSummary] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<"draft" | "published">("draft")
  const [featuredId, setFeaturedId] = useState<number | null>(null)

  useEffect(() => {
    if (recordId === null) return
    let cancelled = false
    themeResourceRequest<{ record?: ThemeRecordItem }>(
      "GET",
      `/api/admin/theme-resources/${resource.id}/${recordId}`,
    )
      .then((body) => {
        if (cancelled || !body.record) return
        const record = body.record
        setTitle(record.title)
        setSlug(record.slug)
        setSlugEdited(true)
        setSummary(record.summary)
        setContent(record.content)
        setStatus(record.status)
        setFeaturedId(record.featured_media_id)
      })
      .catch((reason) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "Записът не можа да бъде зареден.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [recordId, resource.id])

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const body = await themeResourceRequest<{ record: ThemeRecordItem }>(
        recordId === null ? "POST" : "PATCH",
        recordId === null
          ? `/api/admin/theme-resources/${resource.id}`
          : `/api/admin/theme-resources/${resource.id}/${recordId}`,
        { title, slug, summary, content, status, featured_media_id: featuredId },
      )
      toast.success(recordId === null ? `${singular}ът е създаден.` : `${singular}ът е обновен.`)
      saved?.()
      onSaved(body.record)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Записът не можа да бъде запазен."
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const heading = recordId === null ? `Нов ${singular.toLocaleLowerCase("bg")}` : `Редактиране на ${singular.toLocaleLowerCase("bg")}`
  return (
    <AdminShell
      title={heading}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem={resource.label}
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{heading}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[{ label: resource.label, onClick: onBack }, { label: title || heading }]}
          />
        </div>
      </div>
      {loading ? (
        <p role="status">Зареждане…</p>
      ) : (
        <>
          {error && (
            <div className="react-form-error" role="alert">
              <CircleAlert />
              {error}
            </div>
          )}
          <form className="react-page-form" onSubmit={save}>
            <section className="page-editor-basic-panel">
              <header className="page-editor-basic-panel-heading">
                <FileText aria-hidden="true" />
                <span>Основна информация</span>
              </header>
              <div className="page-editor-basic-panel-body">
                <div className="react-form-grid">
                  <label className="react-form-field">
                    <span>Заглавие *</span>
                    <input
                      value={title}
                      maxLength={190}
                      disabled={saving}
                      required
                      onChange={(event) => {
                        const next = event.currentTarget.value
                        setTitle(next)
                        if (!slugEdited) setSlug(slugify(next))
                        changed?.()
                      }}
                    />
                  </label>
                  <label className="react-form-field">
                    <span>URL адрес (slug) *</span>
                    <input
                      value={slug}
                      maxLength={190}
                      disabled={saving}
                      required
                      onChange={(event) => {
                        setSlug(event.currentTarget.value)
                        setSlugEdited(true)
                        changed?.()
                      }}
                    />
                  </label>
                  <div className="react-form-field">
                    <span>Статус</span>
                    <DropdownMenu
                      ariaLabel="Избор на статус"
                      triggerClassName="react-form-dropdown"
                      trigger={
                        <>
                          <span>{status === "published" ? "Публикуван" : "Чернова"}</span>
                          <DropdownChevron />
                        </>
                      }
                    >
                      <DropdownOption
                        selected={status === "draft"}
                        onClick={() => {
                          setStatus("draft")
                          changed?.()
                        }}
                      >
                        Чернова
                      </DropdownOption>
                      <DropdownOption
                        selected={status === "published"}
                        onClick={() => {
                          setStatus("published")
                          changed?.()
                        }}
                      >
                        Публикуван
                      </DropdownOption>
                    </DropdownMenu>
                  </div>
                  <label className="react-form-field" style={{ gridColumn: "1 / -1" }}>
                    <span>Кратко описание</span>
                    <textarea
                      value={summary}
                      maxLength={1000}
                      rows={3}
                      disabled={saving}
                      onChange={(event) => {
                        setSummary(event.currentTarget.value)
                        changed?.()
                      }}
                    />
                  </label>
                  <label className="react-form-field" style={{ gridColumn: "1 / -1" }}>
                    <span>Съдържание</span>
                    <textarea
                      value={content}
                      rows={8}
                      disabled={saving}
                      onChange={(event) => {
                        setContent(event.currentTarget.value)
                        changed?.()
                      }}
                    />
                  </label>
                </div>
              </div>
            </section>
            <CollapsibleSection title="Основно изображение" storageKey={`theme-resource-${resource.id}-media`} icon={FileText}>
              <ImageField
                label="Основно изображение"
                value={featuredId}
                disabled={saving}
                width="20rem"
                description="Показва се заедно със записа в клиентската зона."
                onChange={(id) => {
                  setFeaturedId(id)
                  changed?.()
                }}
              />
            </CollapsibleSection>
            <div className="react-form-actions">
              <LoadingButton type="submit" loading={saving}>
                Запази
              </LoadingButton>
              <button className="react-secondary-button" type="button" onClick={onBack} disabled={saving}>
                Назад
              </button>
            </div>
          </form>
        </>
      )}
    </AdminShell>
  )
}
