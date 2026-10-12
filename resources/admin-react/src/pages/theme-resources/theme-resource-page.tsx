import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { DataTable } from "@/components/data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { TableActionsMenu } from "@/components/table-actions-menu"
import { DateTime } from "@/components/date-time"
import { parse } from "@/lib/flex-time"
import { adminUrl } from "@/lib/admin-routes"
import type { ThemeResourceDefinition } from "@/components/admin-workspace-context"
import { themeResourceRequest, type ThemeRecordItem } from "./api"

export function ThemeResourcePage({
  resource,
  onLogout,
  onNavigate,
  onCreate,
  onEdit,
  loggingOut,
}: {
  resource: ThemeResourceDefinition
  onLogout: () => void
  onNavigate: (label: string) => void
  onCreate: () => void
  onEdit: (record: ThemeRecordItem) => void
  loggingOut: boolean
}) {
  const [records, setRecords] = useState<ThemeRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [viewFilter, setViewFilter] = useState<"active" | "trash">("active")
  const [pendingTrash, setPendingTrash] = useState<ThemeRecordItem | null>(null)
  const [pendingForce, setPendingForce] = useState<ThemeRecordItem | null>(null)
  const singular = resource.singular.toLocaleLowerCase("bg")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    themeResourceRequest<{ records?: ThemeRecordItem[] }>(
      "GET",
      `/api/admin/theme-resources/${resource.id}?view=${viewFilter}`,
    )
      .then((body) => {
        if (!cancelled) setRecords(body.records ?? [])
      })
      .catch((reason) => {
        if (!cancelled)
          toast.error(reason instanceof Error ? reason.message : "Записите не можаха да бъдат заредени.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [resource.id, viewFilter])

  async function changeStatus(record: ThemeRecordItem, status: "draft" | "published") {
    try {
      await themeResourceRequest(
        "PATCH",
        `/api/admin/theme-resources/${resource.id}/${record.id}/status`,
        { status },
      )
      setRecords((current) =>
        current.map((item) => (item.id === record.id ? { ...item, status } : item)),
      )
      toast.success(status === "published" ? "Записът е публикуван." : "Записът е върнат в чернова.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Статусът не можа да бъде променен.")
    }
  }

  async function trash(record: ThemeRecordItem) {
    try {
      await themeResourceRequest("DELETE", `/api/admin/theme-resources/${resource.id}/${record.id}`)
      setRecords((current) => current.filter((item) => item.id !== record.id))
      toast.success("Записът е преместен в кошчето.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Записът не можа да бъде преместен.")
    }
  }

  async function restore(record: ThemeRecordItem) {
    try {
      await themeResourceRequest(
        "POST",
        `/api/admin/theme-resources/${resource.id}/${record.id}/restore`,
      )
      setRecords((current) => current.filter((item) => item.id !== record.id))
      toast.success("Записът е възстановен.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Записът не можа да бъде възстановен.")
    }
  }

  async function forceDelete(record: ThemeRecordItem) {
    try {
      await themeResourceRequest(
        "DELETE",
        `/api/admin/theme-resources/${resource.id}/${record.id}/force`,
      )
      setRecords((current) => current.filter((item) => item.id !== record.id))
      toast.success("Записът е изтрит окончателно.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Записът не можа да бъде изтрит.")
    }
  }

  const filtered = records.filter((record) => {
    const haystack = `${record.title} ${record.slug}`.toLocaleLowerCase("bg")
    if (search.trim() !== "" && !haystack.includes(search.trim().toLocaleLowerCase("bg"))) return false
    if (viewFilter === "active" && statusFilter !== "all" && record.status !== statusFilter) return false
    return true
  })

  return (
    <AdminShell
      title={resource.label}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem={resource.label}
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{viewFilter === "trash" ? "Кошче" : resource.label}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={
              viewFilter === "trash"
                ? [{ label: resource.label, onClick: () => setViewFilter("active") }, { label: "Кошче" }]
                : [{ label: resource.label }]
            }
          />
        </div>
        <button type="button" onClick={onCreate} disabled={viewFilter === "trash"}>
          Нов {singular}
        </button>
      </div>
      <DataTable
        filterStorageKey={`theme-resource-${resource.id}`}
        data={filtered}
        rowKey={(record) => record.id}
        loading={loading}
        emptyMessage={
          records.length === 0
            ? viewFilter === "trash"
              ? "Кошчето е празно."
              : `Няма създадени ${resource.label.toLocaleLowerCase("bg")}.`
            : "Няма записи, отговарящи на филтрите."
        }
        columns={[
          {
            key: "title",
            label: "Заглавие",
            sortable: true,
            sortValue: (record) => record.title,
            render: (record) => (
              <>
                {viewFilter === "trash" ? (
                  record.title
                ) : (
                  <a
                    className="react-page-link"
                    href={adminUrl(`/theme-resources/${resource.id}/${record.id}/edit`)}
                    onClick={(event) => {
                      event.preventDefault()
                      onEdit(record)
                    }}
                  >
                    {record.title}
                  </a>
                )}
                <small>#{record.id}</small>
              </>
            ),
          },
          {
            key: "slug",
            label: "URL адрес",
            sortable: true,
            render: (record) => record.slug,
            sortValue: (record) => record.slug,
          },
          {
            key: "status",
            label: "Статус",
            sortable: true,
            render: (record) => (
              <span className={`react-status-badge status-${record.status}`}>
                {record.status === "published" ? "Публикуван" : "Чернова"}
              </span>
            ),
          },
          {
            key: "updated_at",
            label: "Последна промяна",
            sortable: true,
            render: (record) => <DateTime value={record.updated_at} style="date" />,
            sortValue: (record) => parse(record.updated_at)?.valueOf() ?? 0,
          },
          {
            key: "actions",
            label: "Действия",
            render: (record) => (
              <TableActionsMenu>
                {viewFilter === "active" ? (
                  <>
                    <button type="button" role="menuitem" onClick={() => onEdit(record)}>
                      Редактирай
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        void changeStatus(record, record.status === "published" ? "draft" : "published")
                      }
                    >
                      {record.status === "published" ? "Върни в чернова" : "Публикувай"}
                    </button>
                    <button type="button" role="menuitem" onClick={() => setPendingTrash(record)}>
                      В кошчето
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" role="menuitem" onClick={() => void restore(record)}>
                      Възстанови
                    </button>
                    <button type="button" role="menuitem" onClick={() => setPendingForce(record)}>
                      Изтрий завинаги
                    </button>
                  </>
                )}
              </TableActionsMenu>
            ),
          },
        ]}
        toolbar={
          <>
            <label className="react-filter-field">
              <span>Търсене</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder="Заглавие или адрес"
              />
            </label>
            {viewFilter === "active" && (
              <label className="react-filter-field">
                <span>Статус</span>
                <DropdownMenu
                  ariaLabel="Избор на статус"
                  triggerClassName="react-filter-trigger"
                  trigger={
                    <>
                      <span>
                        {statusFilter === "published"
                          ? "Публикувани"
                          : statusFilter === "draft"
                            ? "Чернови"
                            : "Всички"}
                      </span>
                      <DropdownChevron />
                    </>
                  }
                >
                  <DropdownOption selected={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                    Всички
                  </DropdownOption>
                  <DropdownOption
                    selected={statusFilter === "published"}
                    onClick={() => setStatusFilter("published")}
                  >
                    Публикувани
                  </DropdownOption>
                  <DropdownOption selected={statusFilter === "draft"} onClick={() => setStatusFilter("draft")}>
                    Чернови
                  </DropdownOption>
                </DropdownMenu>
              </label>
            )}
            <label className="react-filter-field">
              <span>Изглед</span>
              <DropdownMenu
                ariaLabel="Избор на изглед"
                triggerClassName="react-filter-trigger"
                trigger={
                  <>
                    <span>{viewFilter === "trash" ? "Кошче" : "Активни"}</span>
                    <DropdownChevron />
                  </>
                }
              >
                <DropdownOption selected={viewFilter === "active"} onClick={() => setViewFilter("active")}>
                  Активни
                </DropdownOption>
                <DropdownOption selected={viewFilter === "trash"} onClick={() => setViewFilter("trash")}>
                  Кошче
                </DropdownOption>
              </DropdownMenu>
            </label>
          </>
        }
      />
      <ConfirmDialog
        open={pendingTrash !== null}
        title="Преместване в кошчето"
        message={pendingTrash ? `„${pendingTrash.title}“ ще бъде преместен в кошчето.` : ""}
        confirmLabel="В кошчето"
        danger
        onCancel={() => setPendingTrash(null)}
        onConfirm={() => {
          const record = pendingTrash
          setPendingTrash(null)
          if (record) void trash(record)
        }}
      />
      <ConfirmDialog
        open={pendingForce !== null}
        title="Окончателно изтриване"
        message={pendingForce ? `„${pendingForce.title}“ ще бъде изтрит без възможност за възстановяване.` : ""}
        confirmLabel="Изтрий завинаги"
        danger
        onCancel={() => setPendingForce(null)}
        onConfirm={() => {
          const record = pendingForce
          setPendingForce(null)
          if (record) void forceDelete(record)
        }}
      />
    </AdminShell>
  )
}
