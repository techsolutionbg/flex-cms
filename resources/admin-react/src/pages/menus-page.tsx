import { t } from "@/lib/admin-i18n"
import { adminUrl } from "@/lib/admin-routes"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { TableActionsMenu } from "@/components/table-actions-menu"
import type { ThemeCapabilities } from "@/components/admin-workspace-context"
import { menuRequest, type MenuIndex, type MenuSummary } from "@/lib/menu-api"
import type { MenuStatus } from "@/lib/menu-api"

const menuStatusLabels: Record<MenuStatus, string> = {
  active: "Активно",
  inactive: "Неактивно",
  draft: "Чернова",
}

export type MenuShellProps = {
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
  capabilities: ThemeCapabilities | null
  error: string | null
}
export function MenusPage({
  capabilities,
  error,
  onCreate,
  onEdit,
  ...shell
}: MenuShellProps & { onCreate: () => void; onEdit: (menu: MenuSummary) => void }) {
  const [data, setData] = useState<MenuIndex | null>(null)
  const [view, setView] = useState<"active" | "trash">("active")
  const [search, setSearch] = useState("")
  const [location, setLocation] = useState("all")
  const [failure, setFailure] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<MenuSummary | null>(null)
  const supported = capabilities?.supports.menus === true
  useEffect(() => {
    if (!supported) return
    const abort = new AbortController()
    setLoading(true)
    setFailure("")
    menuRequest<MenuIndex>(`/api/admin/menus?view=${view}`, "GET", undefined, abort.signal)
      .then(setData)
      .catch((error) => {
        if (!abort.signal.aborted) setFailure(error.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [supported, capabilities?.theme, view])
  useEffect(() => setLocation("all"), [capabilities?.theme])
  async function request(menu: MenuSummary, action: "trash" | "restore" | "force") {
    if (busy) return
    setBusy(true)
    try {
      await menuRequest(
        `/api/admin/menus/${menu.id}${action === "trash" ? "" : `/${action}`}`,
        action === "restore" ? "POST" : "DELETE",
        { version: menu.version },
      )
      setDeleting(null)
      // Remove the changed row immediately, even if refreshing the list fails.
      setData((current) =>
        current
          ? { ...current, menus: current.menus.filter((item) => item.id !== menu.id) }
          : current,
      )
      toast.success(
        action === "trash"
          ? "Менюто е преместено в кошчето."
          : action === "restore"
            ? "Менюто е възстановено."
            : "Менюто е изтрито завинаги.",
      )
      const result = await menuRequest<MenuIndex>(`/api/admin/menus?view=${view}`)
      setData(result)
      setFailure("")
    } catch (error) {
      setFailure((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function changeStatus(menu: MenuSummary, status: MenuStatus) {
    if (busy || menu.status === status || view !== "active") return
    setBusy(true)
    try {
      const result = await menuRequest<{ menu: MenuSummary }>(
        `/api/admin/menus/${menu.id}`,
        "PUT",
        {
          name: menu.name,
          slug: menu.slug,
          status,
          version: menu.version,
        },
      )
      setData((current) =>
        current
          ? {
              ...current,
              menus: current.menus.map((item) =>
                item.id === menu.id
                  ? { ...item, status: result.menu.status, version: result.menu.version }
                  : item,
              ),
            }
          : current,
      )
      setFailure("")
      toast.success(t("Menu status changed to “{status}”.", "core", { status: t(menuStatusLabels[status]) }))
    } catch (error) {
      setFailure((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const filteredMenus = (data?.menus ?? []).filter(
    (menu) =>
      Boolean(menu.deleted_at) === (view === "trash") &&
      `${menu.name} ${menu.slug}`
        .toLocaleLowerCase("bg")
        .includes(search.toLocaleLowerCase("bg")) &&
      (location === "all" ||
        (location === "none"
          ? menu.assignments.length === 0
          : menu.assignments.some(
              (assignment) => assignment.theme === data?.theme && assignment.location === location,
            ))),
  )
  const activeFilterCount =
    (search ? 1 : 0) + (location !== "all" ? 1 : 0) + (view === "trash" ? 1 : 0)
  const columns: DataTableColumn<MenuSummary>[] = [
    {
      key: "name",
      label: "Име",
      sortable: true,
      render: (menu) =>
        view === "trash" ? (
          menu.name
        ) : (
          <a
            className="react-page-link"
            href={adminUrl(`/menus/${menu.id}/edit`)}
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
              if (!busy) onEdit(menu)
            }}
          >
            {menu.name}
          </a>
        ),
    },
    { key: "slug", label: "Идентификатор", sortable: true },
    { key: "item_count", label: "Елементи", sortable: true },
    {
      key: "status",
      label: "Статус",
      sortable: true,
      render: (menu) => (
        <span className={`react-status-badge status-${menu.status}`}>
          {menu.status === "active"
            ? t("Active")
            : menu.status === "inactive"
              ? t("Inactive")
              : t("Draft")}
        </span>
      ),
    },
    {
      key: "assignments",
      label: "Локация",
      render: (menu) =>
        menu.assignments.length ? (
          menu.assignments.map((assignment) => (
            <span
              className="react-table-location"
              key={`${assignment.theme}:${assignment.location}`}
            >
              {assignment.theme === data?.theme
                ? t(data.menu_locations[assignment.location] ?? assignment.location)
                : `${assignment.theme}: ${assignment.location}`}
            </span>
          ))
        ) : (
          <span className="react-table-location-empty">{t("Not assigned to a location")}</span>
        ),
    },
    {
      key: "actions",
      label: "Действия",
      render: (menu) => (
        <TableActionsMenu>
          {view === "active" ? (
            <>
              {(["active", "inactive", "draft"] as MenuStatus[]).map((status) => (
                <DropdownOption
                  key={status}
                  selected={menu.status === status}
                  disabled={busy || loading || menu.status === status}
                  onClick={() => void changeStatus(menu, status)}
                >

                  {t("Status:")} {t(menuStatusLabels[status])}
                </DropdownOption>
              ))}
              <DropdownOption disabled={busy || loading} onClick={() => onEdit(menu)}>

                {t("Edit")}
              </DropdownOption>
              <DropdownOption
                disabled={busy || loading}
                onClick={() => void request(menu, "trash")}
              >

                {t("Move item to trash")}
              </DropdownOption>
            </>
          ) : (
            <>
              <DropdownOption
                disabled={busy || loading}
                onClick={() => void request(menu, "restore")}
              >

                {t("Restore")}
              </DropdownOption>
              <DropdownOption disabled={busy || loading} onClick={() => setDeleting(menu)}>

                {t("Delete forever")}
              </DropdownOption>
            </>
          )}
        </TableActionsMenu>
      ),
    },
  ]
  const title = view === "trash" ? t("Menu trash") : t("Menus")
  return (
    <AdminShell {...shell} title={title} activeItem="Менюта">
      <div className="react-page-heading">
        <div>
          <h1>{title}</h1>
          <Breadcrumbs onHomeClick={() => shell.onNavigate("Табло")} items={[{ label: title }]} />
        </div>
        <button type="button" onClick={onCreate} disabled={!supported || busy || view === "trash"}>

          {t("New menu")}
        </button>
      </div>
      {(error || failure) && (
        <p className="react-form-error" role="alert">
          {error || failure}
        </p>
      )}
      {!capabilities ? (
        <p role="status">{t("Checking active theme…")}</p>
      ) : !supported ? (
        <p>{t("The active theme does not support menu management.")}</p>
      ) : (
        <DataTable
          extensionPoint="menus.list"
          filterStorageKey="menus"
          data={filteredMenus}
          columns={columns}
          rowKey={(menu) => menu.id}
          loading={loading}
          emptyMessage={
            failure
              ? "Менютата не са заредени."
              : search || location !== "all"
                ? t("No menus match the filters.")
                : view === "trash"
                  ? "Кошчето е празно."
                  : "Все още няма менюта. Създайте първото меню."
          }
          toolbar={
            <>
              <label className="react-filter-field">
                <span>{t("Search")}</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Name or identifier")}
                />
              </label>
              <label className="react-filter-field">
                <span>{t("Location")}</span>
                <DropdownMenu
                  ariaLabel={t("Choose location")}
                  triggerClassName="react-filter-trigger"
                  trigger={
                    <>
                      <span>
                        {location === "all"
                          ? t("All locations")
                          : location === "none"
                            ? t("No location")
                            : t(data?.menu_locations[location] ?? location)}
                      </span>
                      <DropdownChevron />
                    </>
                  }
                >
                  <DropdownOption selected={location === "all"} onClick={() => setLocation("all")}>

                    {t("All locations")}
                  </DropdownOption>
                  <DropdownOption
                    selected={location === "none"}
                    onClick={() => setLocation("none")}
                  >

                    {t("No location")}
                  </DropdownOption>
                  {Object.entries(data?.menu_locations ?? {}).map(([id, label]) => (
                    <DropdownOption
                      key={id}
                      selected={location === id}
                      onClick={() => setLocation(id)}
                    >
                      {t(label)}
                    </DropdownOption>
                  ))}
                </DropdownMenu>
              </label>
              <label className="react-filter-field">
                <span>{t("View")}</span>
                <DropdownMenu
                  ariaLabel={t("Choose view")}
                  triggerClassName="react-filter-trigger"
                  trigger={
                    <>
                      <span>{view === "trash" ? t("Trash") : t("Active menus")}</span>
                      <DropdownChevron />
                    </>
                  }
                >
                  <DropdownOption
                    disabled={busy}
                    selected={view === "active"}
                    onClick={() => setView("active")}
                  >

                    {t("Active menus")}
                  </DropdownOption>
                  <DropdownOption
                    disabled={busy}
                    selected={view === "trash"}
                    onClick={() => setView("trash")}
                  >

                    {t("Trash")}
                  </DropdownOption>
                </DropdownMenu>
              </label>
              <button
                className="react-filter-clear"
                type="button"
                disabled={!activeFilterCount || busy}
                onClick={() => {
                  setSearch("")
                  setLocation("all")
                  setView("active")
                }}
              >

                {t("Clear filters")}
              </button>
              <span className="react-filter-count">
                {activeFilterCount ? `${activeFilterCount} приложени филтъра` : t("No filters")}
              </span>
            </>
          }
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t("Permanently delete menu")}
        message={`Менюто „${deleting?.name}“ и всички негови елементи ще бъдат изтрити завинаги. Свързаните страници ще останат.`}
        confirmLabel={t("Delete forever")}
        danger
        busy={busy}
        onCancel={() => {
          if (!busy) setDeleting(null)
        }}
        onConfirm={() => {
          if (deleting) void request(deleting, "force")
        }}
      />
    </AdminShell>
  )
}
