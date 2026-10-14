import { t } from "@/lib/admin-i18n"
import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LoadingButton } from "@/components/loading-button"
import { TableActionsMenu } from "@/components/table-actions-menu"
import type { PageRecord } from "@/lib/admin-types"
import { getCsrfToken } from "@/lib/admin-api"
import { adminUrl } from "@/lib/admin-routes"
import { useWorkspacePanelActive } from "@/components/admin-workspace-context"
import { useExtensions } from "@/components/extension-runtime"
import { publicPagePath } from "./page-utils"
import { DateTime } from "@/components/date-time"
import { parse } from "@/lib/flex-time"

type PageBulkAction = "published" | "draft" | "trash" | "restore" | "force"

function bulkTargets(action: PageBulkAction, pages: PageRecord[]): PageRecord[] {
  switch (action) {
    case "published":
      return pages.filter((page) => page.status === "draft")
    case "draft":
      return pages.filter((page) => page.status === "published")
    default:
      return pages
  }
}

export function PagesPage({
  onLogout,
  onNavigate,
  onCreate,
  onEdit,
  onOpenBuilder,
  onSettings,
  onThemeContent,
  loggingOut,
}: {
  onLogout: () => void
  onNavigate: (label: string) => void
  onCreate: () => void
  onEdit: (page: PageRecord) => void
  onOpenBuilder: (page: PageRecord) => void
  onSettings: (page: PageRecord) => void
  onThemeContent: (page: PageRecord) => void
  loggingOut: boolean
}) {
  const themeContentPanels = useExtensions("page.theme-content", "screen.section")
  const [pages, setPages] = useState<PageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const query = new URLSearchParams(window.location.search)
  const isActivePanel = useWorkspacePanelActive()
  const [search, setSearch] = useState(query.get("search") ?? "")
  const [statusFilter, setStatusFilter] = useState(query.get("status") ?? "all")
  const [structureFilter, setStructureFilter] = useState(query.get("structure") ?? "all")
  const [viewFilter, setViewFilter] = useState(query.get("view") === "trash" ? "trash" : "active")
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string | number>>(new Set())
  const [statusLoadingIds, setStatusLoadingIds] = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState<PageBulkAction | null>(null)
  const [pendingBulkTrash, setPendingBulkTrash] = useState(false)
  const [pendingBulkForce, setPendingBulkForce] = useState(false)
  const [pendingTrashPage, setPendingTrashPage] = useState<PageRecord | null>(null)
  const [pendingForcePage, setPendingForcePage] = useState<PageRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/pages?view=${viewFilter}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          pages?: PageRecord[]
          error?: { message?: string }
        }
        if (!response.ok)
          throw new Error(body.error?.message ?? "Страниците не можаха да бъдат заредени.")
        if (!cancelled) setPages(body.pages ?? [])
      })
      .catch((reason) => {
        if (!cancelled)
          toast.error(
            reason instanceof Error ? reason.message : "Страниците не можаха да бъдат заредени.",
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewFilter])

  useEffect(() => {
    setSelectedPageIds(
      (selected) =>
        new Set([...selected].filter((id) => pages.some((page) => page.id === Number(id)))),
    )
  }, [pages])

  useEffect(() => {
    if (!isActivePanel) return
    const params = new URLSearchParams(window.location.search)
    const values: Array<[string, string, string]> = [
      ["search", search, ""],
      ["status", statusFilter, "all"],
      ["structure", structureFilter, "all"],
      ["view", viewFilter, "active"],
    ]
    values.forEach(([key, value, defaultValue]) =>
      value && value !== defaultValue ? params.set(key, value) : params.delete(key),
    )
    const queryString = params.toString()
    window.history.replaceState(
      null,
      "",
      `${adminUrl("/pages")}${queryString ? `?${queryString}` : ""}`,
    )
  }, [isActivePanel, search, statusFilter, structureFilter, viewFilter])

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
  childrenByParent.forEach((siblings) =>
    siblings.sort((left, right) => (pageOrder.get(left.id) ?? 0) - (pageOrder.get(right.id) ?? 0)),
  )
  const hierarchicalPages: PageRecord[] = []
  function appendPageTree(page: PageRecord) {
    hierarchicalPages.push(page)
    ;(childrenByParent.get(page.id) ?? []).forEach(appendPageTree)
  }
  ;(childrenByParent.get(null) ?? []).forEach(appendPageTree)
  pagesWithDepth.forEach((page) => {
    if (!hierarchicalPages.some((item) => item.id === page.id)) hierarchicalPages.push(page)
  })
  const filteredPages = hierarchicalPages.filter(
    (page) =>
      (statusFilter === "all" || page.status === statusFilter) &&
      (structureFilter === "all" || structureFilter === (page.parent_id ? "child" : "root")) &&
      `${page.title} ${page.slug}`.toLocaleLowerCase("bg").includes(search.toLocaleLowerCase("bg")),
  )
  const activeFilterCount =
    (search ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (structureFilter !== "all" ? 1 : 0) +
    (viewFilter !== "active" ? 1 : 0)
  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
    setStructureFilter("all")
    setViewFilter("active")
  }
  const selectedPages = filteredPages.filter((page) => selectedPageIds.has(page.id))
  const bulkCount = (action: PageBulkAction) => bulkTargets(action, selectedPages).length
  const bulkBusy = bulkAction !== null

  async function pageRequest(
    method: string,
    path: string,
    token: string,
    body?: unknown,
  ): Promise<void> {
    const response = await fetch(path, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        "X-CSRF-Token": token,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string | { message?: string }
    }
    if (!response.ok) {
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : (payload.error?.message ?? "Действието не можа да бъде изпълнено."),
      )
    }
  }

  async function runBulk(action: PageBulkAction) {
    const targets = bulkTargets(action, selectedPages)
    if (targets.length === 0 || bulkBusy) return
    setBulkAction(action)
    const token = await getCsrfToken()
    const succeeded: number[] = []
    const failures: { id: number; title: string; message: string }[] = []
    for (const page of targets) {
      try {
        if (action === "published" || action === "draft") {
          await pageRequest("PATCH", `/api/pages/${page.id}/status`, token, {
            status: action,
          })
          succeeded.push(page.id)
        } else if (action === "trash") {
          await pageRequest("DELETE", `/api/pages/${page.id}`, token)
          succeeded.push(page.id)
        } else if (action === "restore") {
          await pageRequest("POST", `/api/pages/${page.id}/restore`, token)
          succeeded.push(page.id)
        } else {
          await pageRequest("DELETE", `/api/pages/${page.id}/force`, token)
          succeeded.push(page.id)
        }
      } catch (reason) {
        failures.push({
          id: page.id,
          title: page.title,
          message: reason instanceof Error ? reason.message : "Действието не можа да бъде изпълнено.",
        })
      }
    }
    if (succeeded.length > 0) {
      const succeededIds = new Set(succeeded)
      if (action === "published" || action === "draft") {
        setPages((current) =>
          current.map((page) =>
            succeededIds.has(page.id) ? { ...page, status: action } : page,
          ),
        )
      } else {
        setPages((current) => current.filter((page) => !succeededIds.has(page.id)))
      }
    }
    setSelectedPageIds(new Set(failures.map((failure) => failure.id)))
    setBulkAction(null)
    if (succeeded.length > 0) {
      const count = succeeded.length
      const label = count === 1 ? "1 страница" : `${count} страници`
      toast.success(
        action === "published"
          ? `${label}: публикувани.`
          : action === "draft"
            ? `${label}: върнати в чернова.`
            : action === "trash"
              ? `${label}: преместени в кошчето.`
              : action === "restore"
                ? `${label}: възстановени.`
                : `${label}: изтрити окончателно.`,
      )
    }
    if (failures.length > 0) {
      toast.error(`${failures.length} страници не бяха обработени.`, {
        description: failures.map((failure) => `${failure.title}: ${failure.message}`).join("\n"),
      })
    }
  }

  async function changePageStatus(page: PageRecord, status: "draft" | "published") {
    if (bulkBusy) return
    setStatusLoadingIds((current) => new Set(current).add(page.id))
    try {
      const token = await getCsrfToken()
      await pageRequest("PATCH", `/api/pages/${page.id}/status`, token, { status })
      setPages((current) =>
        current.map((item) => (item.id === page.id ? { ...item, status } : item)),
      )
      toast.success(
        status === "published" ? "Страницата е публикувана." : "Страницата е върната в чернова.",
      )
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

  async function trashPage(page: PageRecord) {
    if (bulkBusy) return
    setStatusLoadingIds((current) => new Set(current).add(page.id))
    try {
      const token = await getCsrfToken()
      await pageRequest("DELETE", `/api/pages/${page.id}`, token)
      setPages((current) => current.filter((item) => item.id !== page.id))
      setSelectedPageIds((current) => {
        if (!current.has(page.id)) return current
        const next = new Set(current)
        next.delete(page.id)
        return next
      })
      toast.success("Страницата е преместена в кошчето.")
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Страницата не можа да бъде преместена в кошчето.",
      )
    } finally {
      setStatusLoadingIds((current) => {
        const next = new Set(current)
        next.delete(page.id)
        return next
      })
    }
  }

  async function restorePage(page: PageRecord) {
    if (bulkBusy) return
    setStatusLoadingIds((current) => new Set(current).add(page.id))
    try {
      const token = await getCsrfToken()
      await pageRequest("POST", `/api/pages/${page.id}/restore`, token)
      setPages((current) => current.filter((item) => item.id !== page.id))
      toast.success("Страницата е възстановена.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Страницата не можа да бъде възстановена.")
    } finally {
      setStatusLoadingIds((current) => {
        const next = new Set(current)
        next.delete(page.id)
        return next
      })
    }
  }

  async function forceDeletePage(page: PageRecord) {
    if (bulkBusy) return
    setStatusLoadingIds((current) => new Set(current).add(page.id))
    try {
      const token = await getCsrfToken()
      await pageRequest("DELETE", `/api/pages/${page.id}/force`, token)
      setPages((current) => current.filter((item) => item.id !== page.id))
      setSelectedPageIds((current) => {
        if (!current.has(page.id)) return current
        const next = new Set(current)
        next.delete(page.id)
        return next
      })
      toast.success("Страницата е изтрита окончателно.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Страницата не можа да бъде изтрита.")
    } finally {
      setStatusLoadingIds((current) => {
        const next = new Set(current)
        next.delete(page.id)
        return next
      })
    }
  }
  const columns = [
    {
      key: "title",
      label: "Заглавие",
      sortable: true,
      render: (page: PageRecord) => (
        <>
          <a
            className="react-page-link"
            href={adminUrl(`/pages/${page.id}/edit`)}
            onClick={(event) => {
              event.preventDefault()
              onEdit(page)
            }}
          >
            {"— ".repeat(page.depth ?? 0)}
            {page.title}
          </a>
          {page.settings?.content_builder === "flex/page-builder" && !page.deleted_at && (
            <a
              className="react-table-subtext react-page-builder-link"
              href={adminUrl(`/extension-pages/flex-page-builder-editor/${page.id}/edit`)}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return
                event.preventDefault()
                onOpenBuilder(page)
              }}
            >
              {t("Open in Page Builder")}
            </a>
          )}
        </>
      ),
      sortValue: (page: PageRecord) => page.title,
    },
    {
      key: "slug",
      label: "URL адрес",
      sortable: true,
      render: (page: PageRecord) => `/${publicPagePath(page, pages)}`,
      sortValue: (page: PageRecord) => publicPagePath(page, pages),
    },
    {
      key: "status",
      label: "Статус",
      sortable: true,
      render: (page: PageRecord) => (
        <span className={`react-status-badge status-${page.status}`}>
          {page.status === "published" ? t("Published") : t("Draft")}
        </span>
      ),
    },
    {
      key: "updated_at",
      label: "Последна промяна",
      sortable: true,
      render: (page: PageRecord) => <DateTime value={page.updated_at} style="date" />,
      sortValue: (page: PageRecord) => parse(page.updated_at)?.valueOf() ?? 0,
    },
    {
      key: "actions",
      label: "Действия",
      render: (page: PageRecord) => {
        const statusLoading = statusLoadingIds.has(page.id)
        return (
          <TableActionsMenu>
            {viewFilter === "active" ? (
              <>
                <button type="button" role="menuitem" onClick={() => onEdit(page)}>

                  {t("Edit")}
                </button>
                <button type="button" role="menuitem" onClick={() => onSettings(page)}>

                  {t("Settings")}
                </button>
                {themeContentPanels.length > 0 && (
                  <button type="button" role="menuitem" onClick={() => onThemeContent(page)}>

                    {t("Theme content")}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  disabled={statusLoading || bulkBusy}
                  onClick={() =>
                    void changePageStatus(page, page.status === "published" ? "draft" : "published")
                  }
                >
                  {statusLoading && <LoaderCircle className="react-button-spinner" />}
                  {statusLoading
                    ? t("Waiting…")
                    : page.status === "published"
                      ? t("Move to draft")
                      : t("Publish")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={statusLoading || bulkBusy}
                  onClick={() => setPendingTrashPage(page)}
                >

                  {t("Move item to trash")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={statusLoading || bulkBusy}
                  onClick={() => void restorePage(page)}
                >

                  {t("Restore")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={statusLoading || bulkBusy}
                  onClick={() => setPendingForcePage(page)}
                >

                  {t("Delete forever")}
                </button>
              </>
            )}
          </TableActionsMenu>
        )
      },
    },
  ]

  return (
    <AdminShell
      title={t("Pages")}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Страници"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{viewFilter === "trash" ? t("Trash") : t("Pages")}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[{ label: viewFilter === "trash" ? "Кошче" : "Страници" }]}
          />
        </div>
        <button type="button" onClick={onCreate} disabled={viewFilter === "trash"}>

          {t("New page")}
        </button>
      </div>
      <DataTable
        extensionPoint="pages.list"
        filterStorageKey="pages"
        data={filteredPages}
        columns={columns}
        rowKey={(page) => page.id}
        loading={loading}
        selectable
        selectedKeys={selectedPageIds}
        onSelectionChange={setSelectedPageIds}
        emptyMessage={
          pages.length === 0
            ? viewFilter === "trash"
              ? "Кошчето е празно."
              : t("No pages have been created yet.")
            : t("No pages match the filters.")
        }
        bulkActions={
          <>
            <strong>{selectedPages.length}  {t("Selected")}</strong>
            {viewFilter === "active" ? (
              <>
                <LoadingButton
                  type="button"
                  loading={bulkAction === "published"}
                  disabled={bulkBusy || bulkCount("published") === 0}
                  onClick={() => void runBulk("published")}
                >

                  {t("Publish")}
                  {bulkCount("published") > 0 ? ` (${bulkCount("published")})` : ""}
                </LoadingButton>
                <LoadingButton
                  type="button"
                  loading={bulkAction === "draft"}
                  disabled={bulkBusy || bulkCount("draft") === 0}
                  onClick={() => void runBulk("draft")}
                >

                  {t("Move to draft")}
                  {bulkCount("draft") > 0 ? ` (${bulkCount("draft")})` : ""}
                </LoadingButton>
                <LoadingButton
                  type="button"
                  className="is-danger"
                  loading={bulkAction === "trash"}
                  disabled={bulkBusy || bulkCount("trash") === 0}
                  onClick={() => setPendingBulkTrash(true)}
                >

                  {t("In trash")}
                  {bulkCount("trash") > 0 ? ` (${bulkCount("trash")})` : ""}
                </LoadingButton>
              </>
            ) : (
              <>
                <LoadingButton
                  type="button"
                  loading={bulkAction === "restore"}
                  disabled={bulkBusy || bulkCount("restore") === 0}
                  onClick={() => void runBulk("restore")}
                >

                  {t("Restore")}
                  {bulkCount("restore") > 0 ? ` (${bulkCount("restore")})` : ""}
                </LoadingButton>
                <LoadingButton
                  type="button"
                  className="is-danger"
                  loading={bulkAction === "force"}
                  disabled={bulkBusy || bulkCount("force") === 0}
                  onClick={() => setPendingBulkForce(true)}
                >

                  {t("Delete forever")}
                  {bulkCount("force") > 0 ? ` (${bulkCount("force")})` : ""}
                </LoadingButton>
              </>
            )}
          </>
        }
        toolbar={
          <>
            <label className="react-filter-field">
              <span>{t("Search")}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Title or URL")}
              />
            </label>
            <label className="react-filter-field">
              <span>{t("Status")}</span>
              <DropdownMenu
                ariaLabel={t("Choose status")}
                triggerClassName="react-filter-trigger"
                trigger={
                  <>
                    <span>
                      {statusFilter === "all"
                        ? t("All statuses")
                        : statusFilter === "draft"
                          ? t("Drafts")
                          : t("Published pages")}
                    </span>
                    <DropdownChevron />
                  </>
                }
              >
                <DropdownOption
                  selected={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                >

                  {t("All statuses")}
                </DropdownOption>
                <DropdownOption
                  selected={statusFilter === "draft"}
                  onClick={() => setStatusFilter("draft")}
                >

                  {t("Drafts")}
                </DropdownOption>
                <DropdownOption
                  selected={statusFilter === "published"}
                  onClick={() => setStatusFilter("published")}
                >

                  {t("Published pages")}
                </DropdownOption>
              </DropdownMenu>
            </label>
            <label className="react-filter-field">
              <span>{t("Structure")}</span>
              <DropdownMenu
                ariaLabel={t("Choose page structure")}
                triggerClassName="react-filter-trigger"
                trigger={
                  <>
                    <span>
                      {structureFilter === "all"
                        ? t("All pages")
                        : structureFilter === "root"
                          ? t("Parent pages")
                          : t("Child pages")}
                    </span>
                    <DropdownChevron />
                  </>
                }
              >
                <DropdownOption
                  selected={structureFilter === "all"}
                  onClick={() => setStructureFilter("all")}
                >

                  {t("All pages")}
                </DropdownOption>
                <DropdownOption
                  selected={structureFilter === "root"}
                  onClick={() => setStructureFilter("root")}
                >

                  {t("Parent pages")}
                </DropdownOption>
                <DropdownOption
                  selected={structureFilter === "child"}
                  onClick={() => setStructureFilter("child")}
                >

                  {t("Child pages")}
                </DropdownOption>
              </DropdownMenu>
            </label>
            <label className="react-filter-field">
              <span>{t("View")}</span>
              <DropdownMenu
                ariaLabel={t("Choose view")}
                triggerClassName="react-filter-trigger"
                trigger={
                  <>
                    <span>{viewFilter === "active" ? t("Active pages") : t("Trash")}</span>
                    <DropdownChevron />
                  </>
                }
              >
                <DropdownOption
                  selected={viewFilter === "active"}
                  onClick={() => setViewFilter("active")}
                >

                  {t("Active pages")}
                </DropdownOption>
                <DropdownOption
                  selected={viewFilter === "trash"}
                  onClick={() => setViewFilter("trash")}
                >

                  {t("Trash")}
                </DropdownOption>
              </DropdownMenu>
            </label>
            <button
              className="react-filter-clear"
              type="button"
              onClick={clearFilters}
              disabled={activeFilterCount === 0}
            >

              {t("Clear filters")}
            </button>
            <span className="react-filter-count">
              {activeFilterCount ? `${activeFilterCount} приложени филтъра` : t("No filters")}
            </span>
          </>
        }
      />
      <ConfirmDialog
        open={pendingBulkTrash}
        title={t("Move to trash")}
        message={`${bulkTargets("trash", selectedPages)
          .map((page) => `„${page.title}“`)
          .join(", ")} ще бъдат преместени в кошчето.`}
        confirmLabel={t("In trash")}
        danger
        busy={bulkAction === "trash"}
        onCancel={() => {
          if (!bulkBusy) setPendingBulkTrash(false)
        }}
        onConfirm={() => {
          setPendingBulkTrash(false)
          void runBulk("trash")
        }}
      />
      <ConfirmDialog
        open={pendingBulkForce}
        title={t("Delete permanently")}
        message={`${bulkTargets("force", selectedPages)
          .map((page) => `„${page.title}“`)
          .join(", ")} ще бъдат изтрити завинаги. Действието не може да бъде отменено.`}
        confirmLabel={t("Delete forever")}
        danger
        busy={bulkAction === "force"}
        onCancel={() => {
          if (!bulkBusy) setPendingBulkForce(false)
        }}
        onConfirm={() => {
          setPendingBulkForce(false)
          void runBulk("force")
        }}
      />
      <ConfirmDialog
        open={pendingTrashPage !== null}
        title={t("Move to trash")}
        message={pendingTrashPage ? `Страницата „${pendingTrashPage.title}“ ще бъде преместена в кошчето.` : ""}
        confirmLabel={t("In trash")}
        danger
        busy={pendingTrashPage !== null && statusLoadingIds.has(pendingTrashPage.id)}
        onCancel={() => {
          if (pendingTrashPage === null || !statusLoadingIds.has(pendingTrashPage.id))
            setPendingTrashPage(null)
        }}
        onConfirm={() => {
          if (pendingTrashPage) {
            const page = pendingTrashPage
            setPendingTrashPage(null)
            void trashPage(page)
          }
        }}
      />
      <ConfirmDialog
        open={pendingForcePage !== null}
        title={t("Delete permanently")}
        message={
          pendingForcePage
            ? `Страницата „${pendingForcePage.title}“ ще бъде изтрита завинаги. Действието не може да бъде отменено.`
            : ""
        }
        confirmLabel={t("Delete forever")}
        danger
        busy={pendingForcePage !== null && statusLoadingIds.has(pendingForcePage.id)}
        onCancel={() => {
          if (pendingForcePage === null || !statusLoadingIds.has(pendingForcePage.id))
            setPendingForcePage(null)
        }}
        onConfirm={() => {
          if (pendingForcePage) {
            const page = pendingForcePage
            setPendingForcePage(null)
            void forceDeletePage(page)
          }
        }}
      />
    </AdminShell>
  )
}
