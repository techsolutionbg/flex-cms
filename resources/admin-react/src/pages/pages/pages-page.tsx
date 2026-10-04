import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { LoadingButton } from "@/components/loading-button"
import { TableActionsMenu } from "@/components/table-actions-menu"
import type { PageRecord } from "@/lib/admin-types"
import { adminUrl } from "@/lib/admin-routes"
import { publicPagePath } from "./page-utils"
export function PagesPage({ onLogout, onNavigate, onCreate, onEdit, onSettings, loggingOut }: { onLogout: () => void; onNavigate: (label: string) => void; onCreate: () => void; onEdit: (page: PageRecord) => void; onSettings: (page: PageRecord) => void; loggingOut: boolean }) {
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
    window.history.replaceState(null, "", `${adminUrl("/pages")}${queryString ? `?${queryString}` : ""}`)
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
    { key: "title", label: "Заглавие", sortable: true, render: (page: PageRecord) => <><a className="react-page-link" href={adminUrl(`/pages/${page.id}/edit`)} onClick={(event) => { event.preventDefault(); onEdit(page) }}>{"— ".repeat(page.depth ?? 0)}{page.title}</a><small>#{page.id}</small></>, sortValue: (page: PageRecord) => page.title },
    { key: "slug", label: "URL адрес", sortable: true, render: (page: PageRecord) => `/${publicPagePath(page, pages)}`, sortValue: (page: PageRecord) => publicPagePath(page, pages) },
    { key: "status", label: "Статус", sortable: true, render: (page: PageRecord) => <span className={`react-status-badge status-${page.status}`}>{page.status === "published" ? "Публикувана" : "Чернова"}</span> },
    { key: "updated_at", label: "Последна промяна", sortable: true, render: (page: PageRecord) => page.updated_at ? new Date(page.updated_at).toLocaleDateString("bg-BG") : "—", sortValue: (page: PageRecord) => page.updated_at ?? "" },
    { key: "actions", label: "Действия", render: (page: PageRecord) => { const statusLoading = statusLoadingIds.has(page.id); return <TableActionsMenu><button type="button" role="menuitem" onClick={() => onEdit(page)}>Редактирай</button><button type="button" role="menuitem" onClick={() => onSettings(page)}>Настройки</button><button type="button" role="menuitem" disabled={statusLoading} onClick={() => void changePageStatus(page, page.status === "published" ? "draft" : "published")}>{statusLoading && <LoaderCircle className="react-button-spinner" />}{statusLoading ? "Изчакване…" : page.status === "published" ? "Върни в чернова" : "Публикувай"}</button><button type="button" role="menuitem" onClick={() => toast.info(`„${page.title}“ ще бъде преместена в кошчето в следващата стъпка.`)}>Премести в кошчето</button></TableActionsMenu> } },
  ]

  return <AdminShell title="Страници" onLogout={onLogout} onNavigate={onNavigate} activeItem="Страници" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>{viewFilter === "trash" ? "Кошче" : "Страници"}</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: viewFilter === "trash" ? "Кошче" : "Страници" }]} /></div><button type="button" onClick={onCreate} disabled={viewFilter === "trash"}>Нова страница</button></div>
    <DataTable filterStorageKey="pages" data={filteredPages} columns={columns} rowKey={(page) => page.id} loading={loading} selectable={viewFilter === "active"} selectedKeys={selectedPageIds} onSelectionChange={setSelectedPageIds} emptyMessage={pages.length === 0 ? viewFilter === "trash" ? "Кошчето е празно." : "Няма създадени страници." : "Няма страници, отговарящи на филтрите."} bulkActions={viewFilter === "active" && <><strong>{selectedPageIds.size} избрани</strong><LoadingButton type="button" loading={bulkStatusLoading === "published"} disabled={selectedPageIds.size === 0 || bulkStatusLoading !== null} onClick={() => void changeSelectedStatus("published")}>{bulkStatusLoading === "published" ? "Изчакване…" : "Публикувай"}</LoadingButton><LoadingButton type="button" loading={bulkStatusLoading === "draft"} disabled={selectedPageIds.size === 0 || bulkStatusLoading !== null} onClick={() => void changeSelectedStatus("draft")}>{bulkStatusLoading === "draft" ? "Изчакване…" : "Върни в чернова"}</LoadingButton></>} toolbar={<><label className="react-filter-field"><span>Търсене</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Заглавие или URL адрес" /></label><label className="react-filter-field"><span>Статус</span><DropdownMenu ariaLabel="Избор на статус" triggerClassName="react-filter-trigger" trigger={<><span>{statusFilter === "all" ? "Всички статуси" : statusFilter === "draft" ? "Чернови" : "Публикувани"}</span><DropdownChevron /></>}><DropdownOption selected={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Всички статуси</DropdownOption><DropdownOption selected={statusFilter === "draft"} onClick={() => setStatusFilter("draft")}>Чернови</DropdownOption><DropdownOption selected={statusFilter === "published"} onClick={() => setStatusFilter("published")}>Публикувани</DropdownOption></DropdownMenu></label><label className="react-filter-field"><span>Структура</span><DropdownMenu ariaLabel="Избор на структура" triggerClassName="react-filter-trigger" trigger={<><span>{structureFilter === "all" ? "Всички страници" : structureFilter === "root" ? "Родителски страници" : "Дъщерни страници"}</span><DropdownChevron /></>}><DropdownOption selected={structureFilter === "all"} onClick={() => setStructureFilter("all")}>Всички страници</DropdownOption><DropdownOption selected={structureFilter === "root"} onClick={() => setStructureFilter("root")}>Родителски страници</DropdownOption><DropdownOption selected={structureFilter === "child"} onClick={() => setStructureFilter("child")}>Дъщерни страници</DropdownOption></DropdownMenu></label><label className="react-filter-field"><span>Изглед</span><DropdownMenu ariaLabel="Избор на изглед" triggerClassName="react-filter-trigger" trigger={<><span>{viewFilter === "active" ? "Активни страници" : "Кошче"}</span><DropdownChevron /></>}><DropdownOption selected={viewFilter === "active"} onClick={() => setViewFilter("active")}>Активни страници</DropdownOption><DropdownOption selected={viewFilter === "trash"} onClick={() => setViewFilter("trash")}>Кошче</DropdownOption></DropdownMenu></label><button className="react-filter-clear" type="button" onClick={clearFilters} disabled={activeFilterCount === 0}>Изчисти филтрите</button><span className="react-filter-count">{activeFilterCount ? `${activeFilterCount} приложени филтъра` : "Без филтри"}</span></>} />
  </AdminShell>
}
