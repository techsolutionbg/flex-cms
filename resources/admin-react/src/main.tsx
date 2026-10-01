import { useEffect, useState, type FormEvent } from "react"
import { ArrowRight, CircleAlert, FileText, LoaderCircle, Plus, Puzzle, RefreshCw, UserRound, UsersRound } from "lucide-react"
import { createRoot } from "react-dom/client"
import { Toaster, toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdminShell } from "@/components/admin-shell"
import { CollapsibleSection } from "@/components/collapsible-section"
import { TableActionsMenu } from "@/components/table-actions-menu"
import { DataTable } from "@/components/data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { RichTextEditor } from "@/components/rich-text-editor"
import { LoadingButton } from "@/components/loading-button"
import "./index.css"

function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError("")
    setSubmitting(true)
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", headers: { Accept: "application/json" } })
      const csrfBody = await csrfResponse.json().catch(() => ({})) as { csrf_token?: string }
      if (!csrfResponse.ok || !csrfBody.csrf_token) throw new Error("Не можа да бъде получен токен за сигурност.")
      const loginResponse = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrfBody.csrf_token }, body: JSON.stringify({ email, password }) })
      const loginBody = await loginResponse.json().catch(() => ({})) as { user?: { role?: string }; error?: { message?: string } }
      if (!loginResponse.ok) throw new Error(loginBody.error?.message ?? "Входът не беше успешен.")
      if (loginBody.user?.role !== "super_admin") throw new Error("Достъпът е разрешен само за супер администратор.")
      toast.success("Входът е успешен.")
      onAuthenticated()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Входът не беше успешен."
      setError(message)
      toast.error(message)
      setSubmitting(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f4f5ef] px-4 py-8"><Card className="w-full max-w-md p-6 sm:p-8"><div className="text-center"><img className="mx-auto h-auto w-52" src="/assets/brand/logo.png" alt="Flex CMS" /><p className="mt-5 text-[#687268]">Влезте, за да управлявате сайта.</p></div>{error && <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#ffb4a8] bg-[#fff0ed] p-3 text-sm font-semibold text-[#b93624]" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}<form className="mt-7 space-y-5" onSubmit={submit}><div className="space-y-2"><Label htmlFor="email">Имейл</Label><Input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} required /></div><div className="space-y-2"><Label htmlFor="password">Парола</Label><Input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} required /></div><Button className="w-full" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Проверка…</> : <>Вход <ArrowRight className="ml-2 size-4" /></>}</Button></form></Card></main>
}

type DashboardSummary = { pages: number; active_plugins: number; users: number; version: string }
type PageSettings = { template?: string; menu_order?: number; use_parent_slugs?: boolean; show_in_navigation?: boolean; show_in_sitemap?: boolean }
type PageRecord = { id: number; title: string; slug: string; parent_id?: number | null; depth?: number; status: string; content?: string; settings?: PageSettings; updated_at?: string | null; deleted_at?: string | null }

function publicPagePath(page: PageRecord, pages: PageRecord[]): string {
  if (!page.settings?.use_parent_slugs || !page.parent_id) return page.slug
  const trail = new Set<number>()
  const parts = [page.slug]
  let current = page
  while (current.parent_id && !trail.has(current.id)) {
    trail.add(current.id)
    const parent = pages.find((item) => item.id === current.parent_id)
    if (!parent) break
    parts.unshift(parent.slug)
    current = parent
  }
  return parts.join("/")
}

function DashboardPage({ onLogout, onNavigate, loggingOut }: { onLogout: () => void; onNavigate: (label: string) => void; loggingOut: boolean }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/dashboard", { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json() as DashboardSummary
        if (!response.ok) throw new Error("Данните за таблото не можаха да бъдат заредени.")
        if (!cancelled) setSummary(body)
      })
      .catch((reason) => { if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Данните за таблото не можаха да бъдат заредени.") })
    return () => { cancelled = true }
  }, [])

  const cards = [
    { title: "Страници", icon: FileText, value: summary?.pages, description: "Създадени страници в системата.", action: "Управление на страниците →" },
    { title: "Разширения", icon: Puzzle, value: summary?.active_plugins, description: "Активни разширения.", action: "Управление на разширенията →" },
    { title: "Потребители", icon: UsersRound, value: summary?.users, description: "Потребители, роли и статуси в системата.", action: "Управление на потребителите →" },
  ]

  return (
    <AdminShell onLogout={onLogout} onNavigate={onNavigate} activeItem="Табло" loggingOut={loggingOut}>
      <h1>Административен панел</h1>
      <section className="dashboard-grid-react" aria-label="Обобщение на системата">
        {cards.map(({ title, icon: Icon, value, description, action }) => <CollapsibleSection title={title} icon={Icon} className="dashboard-card-react" key={title}>
          <strong className="dashboard-stat-react">{value ?? "—"}</strong><p>{description}</p><a href="#" onClick={(event) => event.preventDefault()}>{action}</a>
        </CollapsibleSection>)}
        <CollapsibleSection title="Бързи действия" icon={Plus} className="dashboard-card-react"><div className="dashboard-actions-react"><a href="#" onClick={(event) => event.preventDefault()}><Plus />Нова страница</a><a href="#" onClick={(event) => event.preventDefault()}><RefreshCw />Провери обновявания</a><a href="#" onClick={(event) => event.preventDefault()}><UserRound />Профил</a></div></CollapsibleSection>
        <CollapsibleSection title="Обновявания" icon={RefreshCw} className="dashboard-card-react"><p>Проверка, инсталация и управление на platform пакети.</p><a href="#" onClick={(event) => event.preventDefault()}>Отвори обновявания →</a></CollapsibleSection>
        <CollapsibleSection title="Версия на платформата" icon={RefreshCw} className="dashboard-card-react"><p>Текущата инсталирана версия на Flex CMS.</p><strong className="dashboard-version-react">{summary?.version ?? "—"}</strong></CollapsibleSection>
      </section>
    </AdminShell>
  )
}

function PagesPage({ onLogout, onNavigate, onCreate, onEdit, onSettings, loggingOut }: { onLogout: () => void; onNavigate: (label: string) => void; onCreate: () => void; onEdit: (page: PageRecord) => void; onSettings: (page: PageRecord) => void; loggingOut: boolean }) {
  const [pages, setPages] = useState<PageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const query = new URLSearchParams(window.location.search)
  const [search, setSearch] = useState(query.get("search") ?? "")
  const [statusFilter, setStatusFilter] = useState(query.get("status") ?? "all")
  const [structureFilter, setStructureFilter] = useState(query.get("structure") ?? "all")
  const [viewFilter, setViewFilter] = useState(query.get("view") === "trash" ? "trash" : "active")
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string | number>>(new Set())
  const [statusLoadingIds, setStatusLoadingIds] = useState<Set<number>>(new Set())
  const [bulkStatusLoading, setBulkStatusLoading] = useState<"draft" | "published" | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/pages?view=${viewFilter}`, { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json() as { pages?: PageRecord[]; error?: { message?: string } }
        if (!response.ok) throw new Error(body.error?.message ?? "Страниците не можаха да бъдат заредени.")
        if (!cancelled) setPages(body.pages ?? [])
      })
      .catch((reason) => { if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Страниците не можаха да бъдат заредени.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [viewFilter])

  useEffect(() => {
    setSelectedPageIds((selected) => new Set([...selected].filter((id) => pages.some((page) => page.id === Number(id)))))
  }, [pages])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const values: Array<[string, string, string]> = [["search", search, ""], ["status", statusFilter, "all"], ["structure", structureFilter, "all"], ["view", viewFilter, "active"]]
    values.forEach(([key, value, defaultValue]) => value && value !== defaultValue ? params.set(key, value) : params.delete(key))
    const queryString = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}`)
  }, [search, statusFilter, structureFilter, viewFilter])

  const depthCache = new Map<number, number>()
  function depthOf(page: PageRecord, trail = new Set<number>()): number {
    if (depthCache.has(page.id)) return depthCache.get(page.id)!
    if (!page.parent_id || trail.has(page.id)) return 0
    const parent = pages.find((item) => item.id === page.parent_id)
    const depth = parent ? depthOf(parent, new Set(trail).add(page.id)) + 1 : 0
    depthCache.set(page.id, depth)
    return depth
  }
  const pagesWithDepth = pages.map((page) => ({ ...page, depth: depthOf(page) }))
  const pageOrder = new Map(pages.map((page, index) => [page.id, index]))
  const childrenByParent = new Map<number | null, PageRecord[]>()
  pagesWithDepth.forEach((page) => {
    const siblings = childrenByParent.get(page.parent_id ?? null) ?? []
    siblings.push(page)
    childrenByParent.set(page.parent_id ?? null, siblings)
  })
  childrenByParent.forEach((siblings) => siblings.sort((left, right) => (pageOrder.get(left.id) ?? 0) - (pageOrder.get(right.id) ?? 0)))
  const hierarchicalPages: PageRecord[] = []
  function appendPageTree(page: PageRecord) {
    hierarchicalPages.push(page)
    ;(childrenByParent.get(page.id) ?? []).forEach(appendPageTree)
  }
  ;(childrenByParent.get(null) ?? []).forEach(appendPageTree)
  pagesWithDepth.forEach((page) => { if (!hierarchicalPages.some((item) => item.id === page.id)) hierarchicalPages.push(page) })
  const filteredPages = hierarchicalPages.filter((page) => (statusFilter === "all" || page.status === statusFilter) && (structureFilter === "all" || structureFilter === (page.parent_id ? "child" : "root")) && `${page.title} ${page.slug}`.toLocaleLowerCase("bg").includes(search.toLocaleLowerCase("bg")))
  const activeFilterCount = (search ? 1 : 0) + (statusFilter !== "all" ? 1 : 0) + (structureFilter !== "all" ? 1 : 0) + (viewFilter !== "active" ? 1 : 0)
  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
    setStructureFilter("all")
    setViewFilter("active")
  }
  async function changeSelectedStatus(status: "draft" | "published") {
    if (selectedPageIds.size === 0) return
    setBulkStatusLoading(status)
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", headers: { Accept: "application/json" } })
      const csrf = await csrfResponse.json() as { csrf_token?: string }
      const responses = await Promise.all([...selectedPageIds].map((id) => fetch(`/api/pages/${id}/status`, { method: "PATCH", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrf.csrf_token ?? "" }, body: JSON.stringify({ status }) })))
      const failed = responses.find((response) => !response.ok)
      if (failed) throw new Error("Статусът на някои страници не можа да бъде променен.")
      setPages((current) => current.map((page) => selectedPageIds.has(page.id) ? { ...page, status } : page))
      setSelectedPageIds(new Set())
      toast.success(status === "published" ? "Избраните страници са публикувани." : "Избраните страници са върнати в чернова.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Масовото действие не можа да бъде изпълнено.")
    } finally {
      setBulkStatusLoading(null)
    }
  }
  async function changePageStatus(page: PageRecord, status: "draft" | "published") {
    setStatusLoadingIds((current) => new Set(current).add(page.id))
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", headers: { Accept: "application/json" } })
      const csrf = await csrfResponse.json() as { csrf_token?: string }
      const response = await fetch(`/api/pages/${page.id}/status`, { method: "PATCH", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrf.csrf_token ?? "" }, body: JSON.stringify({ status }) })
      const body = await response.json().catch(() => ({})) as { error?: string | { message?: string } }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : body.error?.message ?? "Статусът не можа да бъде променен.")
      setPages((current) => current.map((item) => item.id === page.id ? { ...item, status } : item))
      toast.success(status === "published" ? "Страницата е публикувана." : "Страницата е върната в чернова.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Статусът не можа да бъде променен.")
    } finally {
      setStatusLoadingIds((current) => {
        const next = new Set(current)
        next.delete(page.id)
        return next
      })
    }
  }
  const columns = [
    { key: "title", label: "Заглавие", sortable: true, render: (page: PageRecord) => <><a className="react-page-link" href={`/pages/${page.id}/edit`} onClick={(event) => { event.preventDefault(); onEdit(page) }}>{"— ".repeat(page.depth ?? 0)}{page.title}</a><small>#{page.id}</small></>, sortValue: (page: PageRecord) => page.title },
    { key: "slug", label: "URL адрес", sortable: true, render: (page: PageRecord) => `/${publicPagePath(page, pages)}`, sortValue: (page: PageRecord) => publicPagePath(page, pages) },
    { key: "status", label: "Статус", sortable: true, render: (page: PageRecord) => <span className={`react-status-badge status-${page.status}`}>{page.status === "published" ? "Публикувана" : "Чернова"}</span> },
    { key: "updated_at", label: "Последна промяна", sortable: true, render: (page: PageRecord) => page.updated_at ? new Date(page.updated_at).toLocaleDateString("bg-BG") : "—", sortValue: (page: PageRecord) => page.updated_at ?? "" },
    { key: "actions", label: "Действия", render: (page: PageRecord) => { const statusLoading = statusLoadingIds.has(page.id); return <TableActionsMenu><button type="button" role="menuitem" onClick={() => onEdit(page)}>Редактирай</button><button type="button" role="menuitem" onClick={() => onSettings(page)}>Настройки</button><button type="button" role="menuitem" disabled={statusLoading} onClick={() => void changePageStatus(page, page.status === "published" ? "draft" : "published")}>{statusLoading && <LoaderCircle className="react-button-spinner" />}{statusLoading ? "Изчакване…" : page.status === "published" ? "Върни в чернова" : "Публикувай"}</button><button type="button" role="menuitem" onClick={() => toast.info(`„${page.title}“ ще бъде преместена в кошчето в следващата стъпка.`)}>Премести в кошчето</button></TableActionsMenu> } },
  ]

  return <AdminShell title="Страници" onLogout={onLogout} onNavigate={onNavigate} activeItem="Страници" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>{viewFilter === "trash" ? "Кошче" : "Страници"}</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: viewFilter === "trash" ? "Кошче" : "Страници" }]} /></div><button type="button" onClick={onCreate} disabled={viewFilter === "trash"}>Нова страница</button></div>
    <DataTable data={filteredPages} columns={columns} rowKey={(page) => page.id} loading={loading} selectable={viewFilter === "active"} selectedKeys={selectedPageIds} onSelectionChange={setSelectedPageIds} emptyMessage={pages.length === 0 ? viewFilter === "trash" ? "Кошчето е празно." : "Няма създадени страници." : "Няма страници, отговарящи на филтрите."} bulkActions={viewFilter === "active" && <><strong>{selectedPageIds.size} избрани</strong><LoadingButton type="button" loading={bulkStatusLoading === "published"} disabled={selectedPageIds.size === 0 || bulkStatusLoading !== null} onClick={() => void changeSelectedStatus("published")}>{bulkStatusLoading === "published" ? "Изчакване…" : "Публикувай"}</LoadingButton><LoadingButton type="button" loading={bulkStatusLoading === "draft"} disabled={selectedPageIds.size === 0 || bulkStatusLoading !== null} onClick={() => void changeSelectedStatus("draft")}>{bulkStatusLoading === "draft" ? "Изчакване…" : "Върни в чернова"}</LoadingButton></>} toolbar={<><label className="react-filter-field"><span>Търсене</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Заглавие или URL адрес" /></label><label className="react-filter-field"><span>Статус</span><DropdownMenu ariaLabel="Избор на статус" triggerClassName="react-filter-trigger" trigger={<><span>{statusFilter === "all" ? "Всички статуси" : statusFilter === "draft" ? "Чернови" : "Публикувани"}</span><DropdownChevron /></>}><DropdownOption selected={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Всички статуси</DropdownOption><DropdownOption selected={statusFilter === "draft"} onClick={() => setStatusFilter("draft")}>Чернови</DropdownOption><DropdownOption selected={statusFilter === "published"} onClick={() => setStatusFilter("published")}>Публикувани</DropdownOption></DropdownMenu></label><label className="react-filter-field"><span>Структура</span><DropdownMenu ariaLabel="Избор на структура" triggerClassName="react-filter-trigger" trigger={<><span>{structureFilter === "all" ? "Всички страници" : structureFilter === "root" ? "Родителски страници" : "Дъщерни страници"}</span><DropdownChevron /></>}><DropdownOption selected={structureFilter === "all"} onClick={() => setStructureFilter("all")}>Всички страници</DropdownOption><DropdownOption selected={structureFilter === "root"} onClick={() => setStructureFilter("root")}>Родителски страници</DropdownOption><DropdownOption selected={structureFilter === "child"} onClick={() => setStructureFilter("child")}>Дъщерни страници</DropdownOption></DropdownMenu></label><label className="react-filter-field"><span>Изглед</span><DropdownMenu ariaLabel="Избор на изглед" triggerClassName="react-filter-trigger" trigger={<><span>{viewFilter === "active" ? "Активни страници" : "Кошче"}</span><DropdownChevron /></>}><DropdownOption selected={viewFilter === "active"} onClick={() => setViewFilter("active")}>Активни страници</DropdownOption><DropdownOption selected={viewFilter === "trash"} onClick={() => setViewFilter("trash")}>Кошче</DropdownOption></DropdownMenu></label><button className="react-filter-clear" type="button" onClick={clearFilters} disabled={activeFilterCount === 0}>Изчисти филтрите</button><span className="react-filter-count">{activeFilterCount ? `${activeFilterCount} приложени филтъра` : "Без филтри"}</span></>} />
  </AdminShell>
}

function PageForm({ page, onBack, onSaved, onSettings, onLogout, onNavigate, loggingOut }: { page: PageRecord | null; onBack: () => void; onSaved: (page: PageRecord) => void; onSettings: (page: PageRecord) => void; onLogout: () => void; onNavigate: (label: string) => void; loggingOut: boolean }) {
  const [title, setTitle] = useState(page?.title ?? "")
  const [slug, setSlug] = useState(page?.slug ?? "")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState(page?.status ?? "draft")
  const [parentId, setParentId] = useState<number | null>(page?.parent_id ?? null)
  const [parents, setParents] = useState<PageRecord[]>([])
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
  }, [page])

  useEffect(() => {
    fetch("/api/admin/pages?view=active", { credentials: "include", headers: { Accept: "application/json" } }).then(async (response) => {
      const body = await response.json() as { pages?: PageRecord[] }
      if (response.ok) {
        setParents((body.pages ?? []).filter((item) => item.id !== page?.id))
        if (page) setContent(page.content ?? "")
      }
    }).catch(() => toast.error("Родителските страници не можаха да бъдат заредени."))
  }, [page])

  function slugify(value: string) { return value.toLocaleLowerCase("bg").trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("")
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", headers: { Accept: "application/json" } })
      const csrf = await csrfResponse.json() as { csrf_token?: string }
      const response = await fetch(page ? `/api/pages/${page.id}` : "/api/pages", { method: page ? "PATCH" : "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrf.csrf_token ?? "" }, body: JSON.stringify({ title, slug, content, status, parent_id: parentId }) })
      const body = await response.json().catch(() => ({})) as { page?: PageRecord; error?: string | { message?: string } }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : body.error?.message ?? "Страницата не можа да бъде запазена.")
      toast.success(page ? "Страницата е обновена." : "Страницата е създадена.")
      if (body.page) onSaved(body.page)
    } catch (reason) { const message = reason instanceof Error ? reason.message : "Страницата не можа да бъде запазена."; setError(message); toast.error(message) }
    finally { setSaving(false) }
  }

  return <AdminShell title={page ? "Редактиране на страница" : "Създаване на страница"} onLogout={onLogout} onNavigate={onNavigate} activeItem="Страници" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>{page ? "Редактиране на страница" : "Създаване на страница"}</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={page ? [{ label: "Страници", onClick: onBack }, { label: page.title }] : [{ label: "Страници", onClick: onBack }, { label: "Създаване на страница" }]} /></div>{page && <button type="button" onClick={() => onSettings(page)}>Настройки</button>}</div>
    {error && <div className="react-form-error" role="alert"><CircleAlert />{error}</div>}
    <form className="react-page-form" onSubmit={save}><label>Заглавие *<input value={title} maxLength={190} onChange={(event) => { setTitle(event.target.value); if (!slugEdited) setSlug(slugify(event.target.value)) }} required /></label><label>URL адрес (slug) *<input value={slug} maxLength={190} onChange={(event) => { setSlug(event.target.value); setSlugEdited(true) }} required /></label><label>Родителска страница<DropdownMenu ariaLabel="Избор на родителска страница" triggerClassName="react-form-dropdown" trigger={<><span>{parentId ? parents.find((item) => item.id === parentId)?.title ?? "Избери страница" : "Няма родителска страница"}</span><DropdownChevron /></>}><DropdownOption selected={!parentId} onClick={() => setParentId(null)}>Няма родителска страница</DropdownOption>{parents.map((item) => <DropdownOption key={item.id} selected={parentId === item.id} onClick={() => setParentId(item.id)}>{item.title}</DropdownOption>)}</DropdownMenu></label><label>Съдържание<RichTextEditor value={content} onChange={setContent} /></label><label>Статус<DropdownMenu ariaLabel="Избор на статус" triggerClassName="react-form-dropdown" trigger={<><span>{status === "published" ? "Публикувана" : "Чернова"}</span><DropdownChevron /></>}><DropdownOption selected={status === "draft"} onClick={() => setStatus("draft")}>Чернова</DropdownOption><DropdownOption selected={status === "published"} onClick={() => setStatus("published")}>Публикувана</DropdownOption></DropdownMenu></label><div className="react-form-actions"><button className="react-primary-button" type="submit" disabled={saving}>{saving && <LoaderCircle className="react-button-spinner" />}{saving ? "Записване…" : "Запази страницата"}</button><button type="button" onClick={onBack}>Отказ</button></div></form>
  </AdminShell>
}

function PageSettingsForm({ page, onBack, onSaved, onEdit, onLogout, onNavigate, loggingOut }: { page: PageRecord; onBack: () => void; onSaved: (page: PageRecord) => void; onEdit: (page: PageRecord) => void; onLogout: () => void; onNavigate: (label: string) => void; loggingOut: boolean }) {
  const initial = page.settings ?? {}
  const [settings, setSettings] = useState<PageSettings>({ template: "default", menu_order: 0, use_parent_slugs: false, show_in_navigation: true, show_in_sitemap: true, ...initial })
  const [saving, setSaving] = useState(false)

  async function save(event: FormEvent<HTMLFormElement>) {
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
    <form className="react-page-form" onSubmit={save}><label>Шаблон<DropdownMenu ariaLabel="Избор на шаблон" triggerClassName="react-form-dropdown" trigger={<><span>{settings.template === "full_width" ? "Пълна ширина" : settings.template === "landing" ? "Landing page" : "Стандартен"}</span><DropdownChevron /></>}><DropdownOption selected={settings.template === "default"} onClick={() => setSettings({ ...settings, template: "default" })}>Стандартен</DropdownOption><DropdownOption selected={settings.template === "full_width"} onClick={() => setSettings({ ...settings, template: "full_width" })}>Пълна ширина</DropdownOption><DropdownOption selected={settings.template === "landing"} onClick={() => setSettings({ ...settings, template: "landing" })}>Landing page</DropdownOption></DropdownMenu></label><label>Позиция в навигацията<input type="number" min={0} value={settings.menu_order ?? 0} onChange={(event) => setSettings({ ...settings, menu_order: Number(event.target.value) })} /><small>По-малките числа се показват по-напред.</small></label><div className="react-checkbox-grid"><label><input type="checkbox" checked={settings.show_in_navigation ?? true} onChange={(event) => setSettings({ ...settings, show_in_navigation: event.target.checked })} /> Показвай страницата в навигацията</label><label><input type="checkbox" checked={settings.show_in_sitemap ?? true} onChange={(event) => setSettings({ ...settings, show_in_sitemap: event.target.checked })} /> Включи страницата в sitemap-а</label><label><input type="checkbox" checked={settings.use_parent_slugs ?? false} onChange={(event) => setSettings({ ...settings, use_parent_slugs: event.target.checked })} /> Използвай slug-овете на родителските страници в URL адреса</label></div><div className="react-form-actions"><button className="react-primary-button" type="submit" disabled={saving}>{saving && <LoaderCircle className="react-button-spinner" />}{saving ? "Записване…" : "Запази настройките"}</button><button type="button" onClick={onBack}>Отказ</button></div></form>
  </AdminShell>
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [pageView, setPageView] = useState<"dashboard" | "pages" | "form" | "settings">("dashboard")
  const [editingPage, setEditingPage] = useState<PageRecord | null>(null)

  function pushRoute(path: string) {
    window.history.pushState(null, "", path)
  }

  function goToDashboard() { pushRoute("/"); setPageView("dashboard") }
  function goToPages() { pushRoute("/pages"); setPageView("pages") }

  useEffect(() => {
    function syncRoute() {
      if (window.location.pathname === "/pages") setPageView("pages")
      else if (window.location.pathname === "/" || window.location.pathname === "") setPageView("dashboard")
    }
    window.addEventListener("popstate", syncRoute)
    return () => window.removeEventListener("popstate", syncRoute)
  }, [])

  useEffect(() => {
    if (authenticated !== true) return
    const path = window.location.pathname
    if (path === "/pages") { setPageView("pages"); return }
    if (path === "/pages/create") { setEditingPage(null); setPageView("form"); return }
    const match = path.match(/^\/pages\/(\d+)\/(edit|settings)$/)
    if (!match) return
    setPageView(match[2] === "settings" ? "settings" : "form")
    fetch("/api/admin/pages?view=active", { credentials: "include", headers: { Accept: "application/json" } }).then(async (response) => {
      const body = await response.json() as { pages?: PageRecord[] }
      const selected = (body.pages ?? []).find((item) => item.id === Number(match[1]))
      if (response.ok && selected) setEditingPage(selected)
      else if (response.ok) toast.error("Страницата не е намерена.")
    }).catch(() => toast.error("Страницата не можа да бъде заредена."))
  }, [authenticated])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        const body = await response.json().catch(() => ({})) as { user?: { role?: string } }
        if (!cancelled) setAuthenticated(response.ok && body.user?.role === "super_admin")
      } catch {
        if (!cancelled) setAuthenticated(false)
      }
    }

    void restoreSession()
    return () => { cancelled = true }
  }, [])

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", headers: { Accept: "application/json" } })
      const csrfBody = await csrfResponse.json().catch(() => ({})) as { csrf_token?: string }
      if (!csrfResponse.ok || !csrfBody.csrf_token) throw new Error("Не може да бъде получен токен за сигурност.")

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "X-CSRF-Token": csrfBody.csrf_token },
      })
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? "Излизането не беше успешно.")

      toast.success("Излязохте успешно.")
      setAuthenticated(false)
      setPageView("dashboard")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Излизането не беше успешно.")
    } finally {
      setLoggingOut(false)
    }
  }

  if (authenticated === null) {
    return <main className="auth-loading-screen" aria-label="Проверка на сесия"><LoaderCircle className="size-6 animate-spin text-[#ff8062]" /></main>
  }

  return <>
    <Toaster position="top-center" closeButton richColors theme="light" />
    {authenticated ? pageView === "form" ? <PageForm page={editingPage} onBack={goToPages} onSaved={(savedPage) => { setEditingPage(savedPage); pushRoute(`/pages/${savedPage.id}/edit`); setPageView("form") }} onSettings={(selected) => { setEditingPage(selected); pushRoute(`/pages/${selected.id}/settings`); setPageView("settings") }} onLogout={() => void logout()} onNavigate={(label) => label === "Страници" ? goToPages() : goToDashboard()} loggingOut={loggingOut} /> : pageView === "settings" && editingPage ? <PageSettingsForm page={editingPage} onBack={goToPages} onSaved={(savedPage) => { setEditingPage(savedPage); pushRoute(`/pages/${savedPage.id}/settings`); setPageView("settings") }} onEdit={(selected) => { setEditingPage(selected); pushRoute(`/pages/${selected.id}/edit`); setPageView("form") }} onLogout={() => void logout()} onNavigate={(label) => label === "Страници" ? goToPages() : goToDashboard()} loggingOut={loggingOut} /> : pageView === "pages" ? <PagesPage onLogout={() => void logout()} onNavigate={(label) => label === "Страници" ? goToPages() : goToDashboard()} onCreate={() => { setEditingPage(null); pushRoute("/pages/create"); setPageView("form") }} onEdit={(selected) => { setEditingPage(selected); pushRoute(`/pages/${selected.id}/edit`); setPageView("form") }} onSettings={(selected) => { setEditingPage(selected); pushRoute(`/pages/${selected.id}/settings`); setPageView("settings") }} loggingOut={loggingOut} /> : <DashboardPage onLogout={() => void logout()} onNavigate={(label) => label === "Страници" ? goToPages() : goToDashboard()} loggingOut={loggingOut} /> : <LoginPage onAuthenticated={() => { setAuthenticated(true); pushRoute("/"); setPageView("dashboard") }} />}
  </>
}

createRoot(document.getElementById("root")!).render(<App />)
