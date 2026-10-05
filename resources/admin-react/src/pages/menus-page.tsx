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
      const result = await menuRequest<{ menu: MenuSummary }>(`/api/admin/menus/${menu.id}`, "PUT", {
        name: menu.name,
        slug: menu.slug,
        status,
        version: menu.version,
      })
      setData((current) => current
        ? { ...current, menus: current.menus.map((item) => item.id === menu.id
          ? { ...item, status: result.menu.status, version: result.menu.version }
          : item) }
        : current)
      setFailure("")
      toast.success(`Статусът на менюто е сменен на „${menuStatusLabels[status]}“.`)
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
          <button
            className="react-table-link"
            type="button"
            disabled={busy}
            onClick={() => onEdit(menu)}
          >
            {menu.name}
          </button>
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
            ? "Активно"
            : menu.status === "inactive"
              ? "Неактивно"
              : "Чернова"}
        </span>
      ),
    },
    {
      key: "assignments",
      label: "Локация",
      render: (menu) =>
        menu.assignments.length
          ? menu.assignments.map((assignment) => (
              <span
                className="react-table-location"
                key={`${assignment.theme}:${assignment.location}`}
              >
                {assignment.theme === data?.theme
                  ? (data.menu_locations[assignment.location] ?? assignment.location)
                  : `${assignment.theme}: ${assignment.location}`}
              </span>
            ))
          : <span className="react-table-location-empty">Не е присвоено към локация</span>,
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
                  Статус: {menuStatusLabels[status]}
                </DropdownOption>
              ))}
              <DropdownOption disabled={busy || loading} onClick={() => onEdit(menu)}>
                Редактирай
              </DropdownOption>
              <DropdownOption
                disabled={busy || loading}
                onClick={() => void request(menu, "trash")}
              >
                Премести в кошчето
              </DropdownOption>
            </>
          ) : (
            <>
              <DropdownOption
                disabled={busy || loading}
                onClick={() => void request(menu, "restore")}
              >
                Възстанови
              </DropdownOption>
              <DropdownOption disabled={busy || loading} onClick={() => setDeleting(menu)}>
                Изтрий завинаги
              </DropdownOption>
            </>
          )}
        </TableActionsMenu>
      ),
    },
  ]
  const title = view === "trash" ? "Кошче за менюта" : "Менюта"
  return (
    <AdminShell {...shell} title={title} activeItem="Менюта">
      <div className="react-page-heading">
        <div>
          <h1>{title}</h1>
          <Breadcrumbs onHomeClick={() => shell.onNavigate("Табло")} items={[{ label: title }]} />
        </div>
        <button type="button" onClick={onCreate} disabled={!supported || busy || view === "trash"}>
          Ново меню
        </button>
      </div>
      {(error || failure) && (
        <p className="react-form-error" role="alert">
          {error || failure}
        </p>
      )}
      {!capabilities ? (
        <p role="status">Проверка на активната тема…</p>
      ) : !supported ? (
        <p>Активната тема не поддържа управление на менюта.</p>
      ) : (
        <DataTable
          filterStorageKey="menus"
          data={filteredMenus}
          columns={columns}
          rowKey={(menu) => menu.id}
          loading={loading}
          emptyMessage={
            failure
              ? "Менютата не са заредени."
              : search || location !== "all"
                ? "Няма менюта, отговарящи на филтрите."
                : view === "trash"
                  ? "Кошчето е празно."
                  : "Все още няма менюта. Създайте първото меню."
          }
          toolbar={
            <>
              <label className="react-filter-field">
                <span>Търсене</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Име или идентификатор"
                />
              </label>
              <label className="react-filter-field">
                <span>Локация</span>
                <DropdownMenu
                  ariaLabel="Избор на локация"
                  triggerClassName="react-filter-trigger"
                  trigger={
                    <>
                      <span>
                        {location === "all"
                          ? "Всички локации"
                          : location === "none"
                            ? "Без локация"
                            : (data?.menu_locations[location] ?? location)}
                      </span>
                      <DropdownChevron />
                    </>
                  }
                >
                  <DropdownOption selected={location === "all"} onClick={() => setLocation("all")}>
                    Всички локации
                  </DropdownOption>
                  <DropdownOption
                    selected={location === "none"}
                    onClick={() => setLocation("none")}
                  >
                    Без локация
                  </DropdownOption>
                  {Object.entries(data?.menu_locations ?? {}).map(([id, label]) => (
                    <DropdownOption
                      key={id}
                      selected={location === id}
                      onClick={() => setLocation(id)}
                    >
                      {label}
                    </DropdownOption>
                  ))}
                </DropdownMenu>
              </label>
              <label className="react-filter-field">
                <span>Изглед</span>
                <DropdownMenu
                  ariaLabel="Избор на изглед"
                  triggerClassName="react-filter-trigger"
                  trigger={
                    <>
                      <span>{view === "trash" ? "Кошче" : "Активни менюта"}</span>
                      <DropdownChevron />
                    </>
                  }
                >
                  <DropdownOption
                    disabled={busy}
                    selected={view === "active"}
                    onClick={() => setView("active")}
                  >
                    Активни менюта
                  </DropdownOption>
                  <DropdownOption
                    disabled={busy}
                    selected={view === "trash"}
                    onClick={() => setView("trash")}
                  >
                    Кошче
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
                Изчисти филтрите
              </button>
              <span className="react-filter-count">
                {activeFilterCount ? `${activeFilterCount} приложени филтъра` : "Без филтри"}
              </span>
            </>
          }
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Окончателно изтриване на меню"
        message={`Менюто „${deleting?.name}“ и всички негови елементи ще бъдат изтрити завинаги. Свързаните страници ще останат.`}
        confirmLabel="Изтрий завинаги"
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
