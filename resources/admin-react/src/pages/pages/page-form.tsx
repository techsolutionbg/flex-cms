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
import { Hint, usePageHelp } from "@/components/page-help"
import {
  ExtensionPanels,
  ExtensionScope,
  extensionHasPageContent,
  usePanelSaves,
} from "@/components/extension-page"
import { useExtensions, useTableExtensions } from "@/components/extension-runtime"
import type { PagePluginField, PageRecord } from "@/lib/admin-types"

const BUILTIN_CONTENT_EDITOR = "flex-cms/native"

function PageFormHelp({
  pageTitle,
  isEditing,
  pluginContentEditor,
  contentBuilderName,
  themeContentAvailable,
}: {
  pageTitle: string
  isEditing: boolean
  pluginContentEditor: boolean
  contentBuilderName: string | null
  themeContentAvailable: boolean
}) {
  usePageHelp(
    useMemo(
      () => ({
        title: isEditing ? `Редактиране на страницата „${pageTitle}“` : "Създаване на страница",
        content: (
          <>
            <p>Оттук управлявате съдържанието, адреса и публикуването на страницата.</p>
            <ul>
              <li>
                <strong>Основна информация:</strong> задайте заглавие, URL адрес и родителска
                страница. Заглавието се използва и за навигационната структура на сайта.
              </li>
              <li>
                <strong>Съдържание:</strong>{" "}
                {pluginContentEditor
                  ? `съдържанието се редактира с плъгина ${contentBuilderName}. Отворете го от съответния бутон горе. С „Премахни връзката“ можете да се върнете към вградения редактор.`
                  : "редактирайте текста и оформлението на страницата. Ако е наличен бутон за контактни форми, с него можете да вмъкнете активна форма."}
              </li>
              {themeContentAvailable && (
                <li>
                  <strong>Съдържание от темата:</strong> отворете полетата, предоставени от
                  активната тема за тази страница.
                </li>
              )}
              <li>
                <strong>Основно изображение и допълнителни полета:</strong> добавете водещо
                изображение и попълнете полетата, предоставени от активните разширения.
              </li>
              <li>
                <strong>Публикуване:</strong> изберете „Чернова“, за да продължите редакцията
                по-късно, или „Публикувана“, за да направите страницата достъпна на сайта.
              </li>
            </ul>
            <p>Натиснете „Запази страницата“, за да приложите промените.</p>
          </>
        ),
      }),
      [pageTitle, isEditing, pluginContentEditor, contentBuilderName, themeContentAvailable],
    ),
  )
  return null
}

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
  const [contentEdited, setContentEdited] = useState(false)
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
  const [themeContentAvailable, setThemeContentAvailable] = useState<boolean | null>(null)
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
  const pluginContentEditor = Boolean(contentBuilder && contentBuilder !== BUILTIN_CONTENT_EDITOR)
  const contentBuilderName = contentBuilder === "flex/page-builder"
    ? "Flex Page Builder"
    : contentBuilder === "flex/composer"
      ? "Flex Composer"
      : pluginContentEditor
        ? contentBuilder
        : null

  useEffect(() => {
    let alive = true
    if (!page || themeContentPanels.length === 0) {
      setThemeContentAvailable(false)
      return () => {
        alive = false
      }
    }
    setThemeContentAvailable(null)
    const context = {
      type: "page",
      id: page.id,
      page,
      settings: { template: page.settings?.template ?? "default" },
    }
    void Promise.all(themeContentPanels.map((panel) => extensionHasPageContent(panel, context)))
      .then((availability) => {
        if (alive) setThemeContentAvailable(availability.some(Boolean))
      })
      .catch(() => {
        // Keep the entry point available if a plugin's optional capability check fails.
        if (alive) setThemeContentAvailable(true)
      })
    return () => {
      alive = false
    }
  }, [page?.id, page?.slug, page?.settings?.template, themeContentPanels])

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
    setContentEdited(false)
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
          content_builder: contentEdited
            ? BUILTIN_CONTENT_EDITOR
            : (page?.settings?.content_builder ?? BUILTIN_CONTENT_EDITOR),
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
      setContentEdited(false)
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
        body: JSON.stringify({ ...page.settings, content_builder: BUILTIN_CONTENT_EDITOR }),
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
      <PageFormHelp
        pageTitle={page?.title ?? ""}
        isEditing={Boolean(page)}
        pluginContentEditor={pluginContentEditor}
        contentBuilderName={contentBuilderName}
        themeContentAvailable={themeContentAvailable}
      />
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
            {themeContentAvailable === true && (
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
      {pluginContentEditor && (
        <div className="page-content-builder-notice" role="status">
          <div>
            <strong>Редактор на съдържанието: {contentBuilderName}</strong>
            <span>Секцията „Съдържание“ е скрита, защото редакторът на страницата е плъгинът „{contentBuilderName}“.</span>
          </div>
          <button type="button" onClick={() => setDetachDialogOpen(true)}>
            Премахни връзката
          </button>
        </div>
      )}
      <form className="react-page-form" onSubmit={save}>
          {!pluginContentEditor && <CollapsibleSection
            title="Съдържание"
            icon={FileText}
            className="content-editor-section"
          >
            <div className="react-form-field">
              <Hint>
                Тук редактирате основното съдържание, което се показва в страницата. Можете да
                добавяте текст, изображения и активни контактни форми.
              </Hint>
              <RichTextEditor
                value={content}
                excludeEmbeddableIds={["flex-page-builder-chrome"]}
                onChange={(value) => {
                  setContent(value)
                  setContentEdited(true)
                  changed?.()
                }}
              />
            </div>
          </CollapsibleSection>}
          <CollapsibleSection
            title="Основна информация"
            icon={FolderTree}
            storageKey="page-basic-information"
            className="page-editor-basic-panel page-editor-basic-panel--collapsible"
          >
            <div className="page-editor-basic-panel-body">
              <Hint>
                Заглавието и URL адресът помагат на посетителите да разпознават страницата и да я
                отварят на правилния адрес.
              </Hint>
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
                  <small>Изберете ясно заглавие — то се вижда като име на страницата.</small>
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
                  <small>Последната част от адреса трябва да е кратка и уникална.</small>
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
                  <small>Родителската страница определя мястото ѝ в йерархията и адреса ѝ.</small>
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
          <ExtensionPanels
            location="page.editor"
            context={panelContext}
            saves={saves}
            hint="Тази секция е добавена от разширение и съдържа настройки за страницата."
          />
          {Object.entries(groupedFields).map(([plugin, fields]) => (
            <CollapsibleSection
              key={plugin}
              title={`Полета от ${fields[0].plugin_name}`}
              icon={Puzzle}
            >
              <p className="react-plugin-provider">
                Разширение {fields[0].plugin_name} · версия {fields[0].plugin_version}
              </p>
              <Hint>Тези полета се управляват от разширението и допълват настройките на страницата.</Hint>
              <div className="react-plugin-fields-inner">
                {fields.map((field) => {
                  const current = pluginFields[field.plugin]?.[field.id] ?? field.default
                  return (
                    <div className="page-plugin-field" key={`${field.plugin}.${field.id}`}>
                      {field.type === "checkbox" ? (
                        <CheckboxField
                          checked={Boolean(current)}
                          label={field.label}
                          description={field.hint}
                          onChange={(event) => setPluginField(field, event.target.checked)}
                        />
                      ) : (
                        <label className="react-form-field">
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
                      )}
                    </div>
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
            <Hint>
              Черновите страници не са видими за посетителите. Публикувайте страницата, когато е
              готова.
            </Hint>
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
        title="Премахване на връзката с редактора"
        message={`Страницата ще спре да използва плъгина „${contentBuilderName ?? "текущия редактор"}“. HTML съдържанието ще остане запазено, секцията „Съдържание“ ще стане достъпна, а документът на плъгина няма да бъде изтрит.`}
        confirmLabel="Премахни връзката"
        busy={detachingBuilder}
        onConfirm={() => void detachContentBuilder()}
        onCancel={() => setDetachDialogOpen(false)}
      />
    </AdminShell>
  )
}
