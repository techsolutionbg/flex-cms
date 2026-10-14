import { Save } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react"
import { CircleAlert, FileText, FolderTree, Puzzle, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { CheckboxField } from "@/components/checkbox-field"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { RichTextEditor } from "@/components/rich-text-editor"
import { ImageField } from "@/components/image-field"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { useWorkspaceChanged } from "@/components/admin-workspace-context"
import { ExtensionPanels, ExtensionScope, usePanelSaves } from "@/components/extension-page"
import { useExtensions, useTableExtensions } from "@/components/extension-runtime"
import type { PagePluginField, PageRecord } from "@/lib/admin-types"

type PageFormProps = {
  page: PageRecord | null
  onBack: () => void
  onSaved: (page: PageRecord) => void
  onSettings: (page: PageRecord) => void
  onThemeContent: (page: PageRecord) => void
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
}

export function PageForm({
  page,
  onBack,
  onSaved,
  onSettings,
  onThemeContent,
  onLogout,
  onNavigate,
  loggingOut,
}: PageFormProps) {
  const [title, setTitle] = useState(page?.title ?? "")
  const [slug, setSlug] = useState(page?.slug ?? "")
  const [content, setContent] = useState(page?.content ?? "")
  const [status, setStatus] = useState(page?.status ?? "draft")
  const [parentId, setParentId] = useState<number | null>(page?.parent_id ?? null)
  const [parents, setParents] = useState<PageRecord[]>([])
  const [pageFields, setPageFields] = useState<PagePluginField[]>([])
  const [pluginFields, setPluginFields] = useState<
    Record<string, Record<string, string | boolean>>
  >(page?.plugin_fields ?? {})
  const [slugEdited, setSlugEdited] = useState(Boolean(page))
  const [saving, setSaving] = useState(false)
  const [detachDialogOpen, setDetachDialogOpen] = useState(false)
  const [detachingBuilder, setDetachingBuilder] = useState(false)
  const [error, setError] = useState("")
  const [featuredId, setFeaturedId] = useState<number | null>(page?.featured_media_id ?? null)
  const changed = useWorkspaceChanged()
  const saves = usePanelSaves()
  const themeContentPanels = useExtensions("page.theme-content", "screen.section")
  const pageListExtensions = useTableExtensions<PageRecord>(
    page ? "pages.list" : undefined,
    page ? [page] : [],
    page ? String(page.id) : "new",
  )
  // Heading tools from plugins (Page Builder, Composer). Skip SEO / theme-content —
  // SEO stays in the editor panel; theme content has its own button below.
  const pageTools = page
    ? pageListExtensions.rowActions.filter((action) => {
        if (action.visible && !action.visible(page)) return false
        const label = action.label.trim().toLowerCase()
        if (label.includes("seo")) return false
        if (label.includes("съдържание от темата") || label.includes("съдържание на шаблона")) {
          return false
        }
        return true
      })
    : []
  const syncedPageId = useRef<number | null>(page?.id ?? null)
  // Panels of active plugins (for example Flex SEO) see the unsaved values while the user types.
  const panelContext = useMemo(
    () => ({
      type: "page",
      id: page?.id ?? null,
      values: { title, slug, content, featured_media_id: featuredId, status, parent_id: parentId },
      settings: { template: page?.settings?.template ?? "default" },
    }),
    [page?.id, page?.settings?.template, title, slug, content, featuredId, status, parentId],
  )
  const extensionScope = useMemo(
    () => ({ context: panelContext, saves }),
    [panelContext, saves],
  )
  const pageId = page?.id ?? null
  const contentBuilder = page?.settings?.content_builder ?? null
  const contentBuilderName = contentBuilder === "flex/page-builder"
    ? "Flex Page Builder"
    : contentBuilder

  // Sync from the server when opening a different page — never reset the create form while typing.
  useEffect(() => {
    if (pageId === null) {
      syncedPageId.current = null
      return
    }
    if (syncedPageId.current === pageId) return
    syncedPageId.current = pageId
    setTitle(page!.title)
    setSlug(page!.slug)
    setContent(page!.content ?? "")
    setFeaturedId(page!.featured_media_id ?? null)
    setStatus(page!.status ?? "draft")
    setParentId(page!.parent_id ?? null)
    setSlugEdited(true)
    setPluginFields(page!.plugin_fields ?? {})
  }, [pageId, page])

  useEffect(() => {
    fetch("/api/admin/pages?view=active", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          pages?: PageRecord[]
          page_fields?: PagePluginField[]
        }
        if (response.ok) {
          setParents((body.pages ?? []).filter((item) => item.id !== page?.id))
          setPageFields(body.page_fields ?? [])
        }
      })
      .catch(() => toast.error("Родителските страници не можаха да бъдат заредени."))
  }, [page])

  function slugify(value: string) {
    return value
      .toLocaleLowerCase("bg")
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
  }
  function setPluginField(field: PagePluginField, value: string | boolean) {
    setPluginFields((current) => ({
      ...current,
      [field.plugin]: { ...(current[field.plugin] ?? {}), [field.id]: value },
    }))
  }
  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      const csrf = (await csrfResponse.json()) as { csrf_token?: string }
      const response = await fetch(page ? `/api/pages/${page.id}` : "/api/pages", {
        method: page ? "PATCH" : "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf.csrf_token ?? "",
        },
        body: JSON.stringify({
          title,
          slug,
          content,
          featured_media_id: featuredId,
          status,
          parent_id: parentId,
          plugin_fields: pluginFields,
        }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        page?: PageRecord
        error?:
          | string
          | {
              message?: string
              details?: { fields?: Record<string, string[]> }
            }
      }
      if (!response.ok) {
        const fieldErrors = typeof body.error === "object" ? body.error.details?.fields : undefined
        const fieldMessage =
          fieldErrors &&
          Object.entries(fieldErrors)
            .flatMap(([field, messages]) => messages.map((message: string) => `${field}: ${message}`))
            .join(" ")
        throw new Error(
          fieldMessage ||
            (typeof body.error === "string"
              ? body.error
              : (body.error?.message ?? "Страницата не можа да бъде запазена.")),
        )
      }
      let panelFailure = ""
      try {
        await saves.run({ id: body.page?.id ?? page?.id ?? null })
      } catch (reason) {
        panelFailure = reason instanceof Error ? reason.message : String(reason)
      }
      if (panelFailure === "")
        toast.success(page ? "Страницата е обновена." : "Страницата е създадена.")
      else {
        setError(panelFailure)
        toast.error("Страницата е запазена, но разширение не записа данните си: " + panelFailure)
      }
      if (body.page) onSaved({ ...body.page, plugin_fields: pluginFields })
      if (panelFailure !== "") changed?.()
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Страницата не можа да бъде запазена."
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function detachContentBuilder() {
    if (!page || !contentBuilder) return
    setDetachingBuilder(true)
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
        body: JSON.stringify({ ...page.settings, content_builder: null }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        page?: PageRecord
        error?: string | { message?: string }
      }
      if (!response.ok)
        throw new Error(typeof body.error === "string" ? body.error : (body.error?.message ?? "Връзката с билдъра не можа да бъде премахната."))
      if (body.page) onSaved(body.page)
      setDetachDialogOpen(false)
      toast.success("Връзката с билдъра е премахната. HTML съдържанието е запазено.")
      changed?.()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Връзката с билдъра не можа да бъде премахната."
      toast.error(message)
    } finally {
      setDetachingBuilder(false)
    }
  }

  const groupedFields = pageFields.reduce<Record<string, PagePluginField[]>>((groups, field) => {
    ;(groups[field.plugin] ??= []).push(field)
    return groups
  }, {})
  return (
    <AdminShell
      title={page ? "Редактиране на страница" : "Създаване на страница"}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Страници"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{page ? "Редактиране на страница" : "Създаване на страница"}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={
              page
                ? [{ label: "Страници", onClick: onBack }, { label: page.title }]
                : [{ label: "Страници", onClick: onBack }, { label: "Създаване на страница" }]
            }
          />
        </div>
        {page && (
          <div className="react-page-heading-actions">
            {pageTools.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => void action.onSelect(page, pageListExtensions.helpers)}
              >
                {action.label}
              </button>
            ))}
            {themeContentPanels.length > 0 && (
              <button type="button" onClick={() => onThemeContent(page)}>
                Съдържание от темата
              </button>
            )}
            <button type="button" onClick={() => onSettings(page)}>
              Настройки
            </button>
          </div>
        )}
      </div>
      {error && (
        <div className="react-form-error" role="alert">
          <CircleAlert />
          {error}
        </div>
      )}
      {contentBuilder && (
        <div className="page-content-builder-notice" role="status">
          <div>
            <strong>Редактор на съдържанието: {contentBuilderName}</strong>
            <span>Секцията „Съдържание“ е скрита, докато този builder е свързан със страницата.</span>
          </div>
          <button type="button" onClick={() => setDetachDialogOpen(true)}>
            Премахни връзката
          </button>
        </div>
      )}
      <form className="react-page-form" onSubmit={save}>
          <CollapsibleSection
            title="Основна информация"
            icon={FolderTree}
            storageKey="page-basic-information"
            className="page-editor-basic-panel page-editor-basic-panel--collapsible"
          >
            <div className="page-editor-basic-panel-body">
              <div className="react-form-grid">
                <label className="react-form-field">
                  <span>Заглавие *</span>
                  <input
                    name="title"
                    value={title}
                    maxLength={190}
                    disabled={saving}
                    autoComplete="off"
                    onChange={(event) => {
                      const next = event.currentTarget.value
                      setTitle(next)
                      if (!slugEdited) setSlug(slugify(next))
                      changed?.()
                    }}
                    required
                  />
                </label>
                <label className="react-form-field">
                  <span>URL адрес (slug) *</span>
                  <input
                    name="slug"
                    value={slug}
                    maxLength={190}
                    disabled={saving}
                    autoComplete="off"
                    onChange={(event) => {
                      setSlug(event.currentTarget.value)
                      setSlugEdited(true)
                      changed?.()
                    }}
                    required
                  />
                </label>
                <div className="react-form-field">
                  <span>Родителска страница</span>
                  <DropdownMenu
                    ariaLabel="Избор на родителска страница"
                    triggerClassName="react-form-dropdown"
                    trigger={
                      <>
                        <span>
                          {parentId
                            ? (parents.find((item) => item.id === parentId)?.title ??
                              "Избери страница")
                            : "Няма родителска страница"}
                        </span>
                        <DropdownChevron />
                      </>
                    }
                  >
                    <DropdownOption
                      selected={!parentId}
                      onClick={() => {
                        setParentId(null)
                        changed?.()
                      }}
                    >
                      Няма родителска страница
                    </DropdownOption>
                    {parents.map((item) => (
                      <DropdownOption
                        key={item.id}
                        selected={parentId === item.id}
                        onClick={() => {
                          setParentId(item.id)
                          changed?.()
                        }}
                      >
                        {item.title}
                      </DropdownOption>
                    ))}
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </CollapsibleSection>
          <ExtensionScope value={extensionScope}>
          <CollapsibleSection
            extensionPoint="page.editor.featured-image"
            title="Основно изображение"
            storageKey="page-featured-media"
            icon={FileText}
            className="page-featured-media-section"
          >
            <ImageField
              label="Основно изображение"
              value={featuredId}
              disabled={saving}
              width="20rem"
              fit="contain"
              description="Темата може да използва това изображение като водещо за страницата."
              onChange={(id) => {
                setFeaturedId(id)
                changed?.()
              }}
            />
          </CollapsibleSection>
          {!contentBuilder && <CollapsibleSection
            extensionPoint="page.editor.content"
            title="Съдържание"
            icon={FileText}
            className="content-editor-section"
          >
            <div className="react-form-field">
              <span>Съдържание</span>
              <RichTextEditor
                value={content}
                onChange={(value) => {
                  setContent(value)
                  changed?.()
                }}
              />
            </div>
          </CollapsibleSection>}
          <ExtensionPanels location="page.editor" context={panelContext} saves={saves} />
          {Object.entries(groupedFields).map(([plugin, fields]) => (
            <CollapsibleSection
              key={plugin}
              title={`Полета от ${fields[0].plugin_name}`}
              icon={Puzzle}
            >
              <p className="react-plugin-provider">
                Разширение {fields[0].plugin_name} · версия {fields[0].plugin_version}
              </p>
              <div className="react-plugin-fields-inner">
                {fields.map((field) => {
                  const current = pluginFields[field.plugin]?.[field.id] ?? field.default
                  return field.type === "checkbox" ? (
                    <CheckboxField
                      key={`${field.plugin}.${field.id}`}
                      checked={Boolean(current)}
                      label={field.label}
                      description={field.hint}
                      onChange={(event) => setPluginField(field, event.target.checked)}
                    />
                  ) : (
                    <label key={`${field.plugin}.${field.id}`}>
                      {field.label}
                      {field.type === "textarea" ? (
                        <Textarea
                          value={String(current ?? "")}
                          maxLength={field.max_length ?? 10000}
                          onChange={(event) => setPluginField(field, event.target.value)}
                        />
                      ) : (
                        <input
                          value={String(current ?? "")}
                          maxLength={field.max_length}
                          onChange={(event) => setPluginField(field, event.target.value)}
                        />
                      )}
                      {field.hint && <small>{field.hint}</small>}
                    </label>
                  )
                })}
              </div>
            </CollapsibleSection>
          ))}
          <CollapsibleSection
            extensionPoint="page.editor.publishing"
            title="Публикуване"
            icon={Settings2}
          >
            <label>
              Статус
              <DropdownMenu
                ariaLabel="Избор на статус"
                triggerClassName="react-form-dropdown"
                trigger={
                  <>
                    <span>{status === "published" ? "Публикувана" : "Чернова"}</span>
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
                  Публикувана
                </DropdownOption>
              </DropdownMenu>
            </label>
          </CollapsibleSection>
          </ExtensionScope>
          <div className="react-form-actions">
            <LoadingButton
              icon={<Save aria-hidden="true" />}
              loading={saving}
              className="react-primary-button"
              type="submit"
              disabled={saving}
            >
              {saving ? "Записване…" : "Запази страницата"}
            </LoadingButton>
            <button type="button" onClick={onBack}>
              Отказ
            </button>
          </div>
        </form>
      <ConfirmDialog
        open={detachDialogOpen}
        title="Премахване на връзката с builder"
        message={`Страницата ще спре да се управлява от ${contentBuilderName ?? "текущия builder"}. HTML съдържанието ще остане запазено, секцията „Съдържание“ ще стане достъпна, а документът на builder-а няма да бъде изтрит.`}
        confirmLabel="Премахни връзката"
        busy={detachingBuilder}
        onConfirm={() => void detachContentBuilder()}
        onCancel={() => setDetachDialogOpen(false)}
      />
    </AdminShell>
  )
}
