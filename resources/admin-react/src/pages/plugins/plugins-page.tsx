import { useEffect, useState } from "react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { AdminShell } from "@/components/admin-shell"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { LoadingButton } from "@/components/loading-button"
import { TableActionsMenu } from "@/components/table-actions-menu"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { getCsrfToken } from "@/lib/admin-api"
import type { PluginRecord } from "@/lib/admin-types"
import { toast } from "sonner"

const statusLabels: Record<string, string> = {
  active: "Активно",
  installed: "Инсталирано",
  inactive: "Неактивно",
  error: "Грешка",
  discovered: "Неинсталирано",
}
type PluginAction = "install" | "activate" | "deactivate" | "update_remote" | "uninstall"
type PluginsPageProps = {
  onLogout: () => void
  onNavigate: (label: string) => void
  onCatalog: () => void
  onView: (plugin: PluginRecord) => void
  loggingOut: boolean
}

export function PluginsPage({
  onLogout,
  onNavigate,
  onCatalog,
  onView,
  loggingOut,
}: PluginsPageProps) {
  const query = new URLSearchParams(window.location.search)
  const [plugins, setPlugins] = useState<PluginRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(query.get("search") ?? "")
  const [statusFilter, setStatusFilter] = useState(query.get("status") ?? "all")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<PluginRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/plugins", { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          plugins?: PluginRecord[]
          error?: { message?: string }
        }
        if (!response.ok)
          throw new Error(body.error?.message ?? "Разширенията не можаха да бъдат заредени.")
        if (!cancelled) setPlugins(body.plugins ?? [])
      })
      .catch((reason) => {
        if (!cancelled)
          toast.error(
            reason instanceof Error ? reason.message : "Разширенията не можаха да бъдат заредени.",
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter !== "all") params.set("status", statusFilter)
    window.history.replaceState(null, "", `/plugins${params.toString() ? `?${params}` : ""}`)
  }, [search, statusFilter])

  const filteredPlugins = plugins.filter(
    (plugin) =>
      (statusFilter === "all" || plugin.status === statusFilter) &&
      `${plugin.name} ${plugin.id} ${plugin.description}`
        .toLocaleLowerCase("bg")
        .includes(search.toLocaleLowerCase("bg")),
  )
  const activeFilterCount = (search ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)
  function clearFilters() {
    setSearch("")
    setStatusFilter("all")
  }

  async function runAction(plugin: PluginRecord, action: PluginAction) {
    if (busyId !== null) return
    setBusyId(plugin.id)
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/plugins/action", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({ id: plugin.id, action }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        plugin?: PluginRecord
        error?: { message?: string }
      }
      if (!response.ok)
        throw new Error(body.error?.message ?? "Действието не можа да бъде изпълнено.")
      if (action === "uninstall")
        setPlugins((current) => current.filter((item) => item.id !== plugin.id))
      else if (body.plugin)
        setPlugins((current) =>
          current.map((item) => (item.id === plugin.id ? body.plugin! : item)),
        )
      toast.success(
        action === "install"
          ? "Разширението е инсталирано."
          : action === "activate"
            ? "Разширението е активирано."
            : action === "deactivate"
              ? "Разширението е деактивирано."
              : action === "update_remote"
                ? "Разширението е обновено."
                : "Разширението е премахнато.",
      )
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Действието не можа да бъде изпълнено.",
      )
    } finally {
      setBusyId(null)
    }
  }

  const columns: DataTableColumn<PluginRecord>[] = [
    {
      key: "name",
      label: "Име",
      sortable: true,
      render: (plugin) => (
        <>
          <button className="react-table-link" type="button" onClick={() => onView(plugin)}>
            {plugin.name}
          </button>
          <small className="react-table-subtext">{plugin.id}</small>
        </>
      ),
      sortValue: (plugin) => plugin.name,
    },
    {
      key: "description",
      label: "Описание",
      sortable: true,
      render: (plugin) => plugin.description || "—",
      sortValue: (plugin) => plugin.description,
    },
    {
      key: "version",
      label: "Версия",
      sortable: true,
      render: (plugin) => (
        <>
          {plugin.version}
          {plugin.update_available && (
            <>
              <small className="react-table-update">Нова: {plugin.available_version}</small>
              {plugin.available_release_notes && (
                <small className="react-table-release-notes">
                  Какво ново: {plugin.available_release_notes}
                </small>
              )}
            </>
          )}
        </>
      ),
    },
    {
      key: "status",
      label: "Статус",
      sortable: true,
      render: (plugin) => (
        <span className={`react-status-badge status-${plugin.status}`}>
          <span className="status-dot" />
          {statusLabels[plugin.status] ?? plugin.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Действия",
      render: (plugin) => {
        const busy = busyId === plugin.id
        return (
          <TableActionsMenu>
            <button type="button" role="menuitem" onClick={() => onView(plugin)}>
              Преглед
            </button>
            {plugin.status !== "discovered" && (
              <button
                type="button"
                role="menuitem"
                disabled={busy || !plugin.update_available}
                onClick={() => void runAction(plugin, "update_remote")}
              >
                {busy && <span className="react-button-spinner" />}Обнови
              </button>
            )}
            {plugin.status === "discovered" ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void runAction(plugin, "install")}
              >
                {busy && <span className="react-button-spinner" />}Инсталирай
              </button>
            ) : plugin.status === "active" ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void runAction(plugin, "deactivate")}
              >
                {busy && <span className="react-button-spinner" />}Деактивирай
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void runAction(plugin, "activate")}
              >
                {busy && <span className="react-button-spinner" />}Активирай
              </button>
            )}
            <button
              className="is-danger"
              type="button"
              role="menuitem"
              disabled={busy || plugin.status === "discovered"}
              onClick={() => setPendingRemoval(plugin)}
            >
              Премахни
            </button>
          </TableActionsMenu>
        )
      },
    },
  ]

  return (
    <AdminShell
      title="Разширения"
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Разширения"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>Разширения</h1>
          <Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Разширения" }]} />
        </div>
        <button type="button" onClick={onCatalog}>
          Каталог с разширения
        </button>
      </div>
      <DataTable
        filterStorageKey="plugins"
        data={filteredPlugins}
        columns={columns}
        rowKey={(plugin) => plugin.id}
        loading={loading}
        emptyMessage={
          plugins.length === 0
            ? "Няма открити разширения."
            : "Няма разширения, отговарящи на филтрите."
        }
        toolbar={
          <>
            <label className="react-filter-field">
              <span>Търсене</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Име, ID или описание"
              />
            </label>
            <label className="react-filter-field">
              <span>Статус</span>
              <DropdownMenu
                ariaLabel="Избор на статус"
                triggerClassName="react-filter-trigger"
                trigger={
                  <>
                    <span>
                      {statusFilter === "all" ? "Всички статуси" : statusLabels[statusFilter]}
                    </span>
                    <DropdownChevron />
                  </>
                }
              >
                <DropdownOption
                  selected={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                >
                  Всички статуси
                </DropdownOption>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <DropdownOption
                    key={value}
                    selected={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </DropdownOption>
                ))}
              </DropdownMenu>
            </label>
            <LoadingButton
              className="react-filter-clear"
              type="button"
              onClick={clearFilters}
              disabled={activeFilterCount === 0}
            >
              Изчисти филтрите
            </LoadingButton>
            <span className="react-filter-count">
              {activeFilterCount ? `${activeFilterCount} приложени филтъра` : "Без филтри"}
            </span>
          </>
        }
      />
      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Премахване на разширение"
        message={
          pendingRemoval
            ? `Разширението „${pendingRemoval.name}“ ще бъде премахнато окончателно. Ако е активно, първо ще бъде деактивирано.`
            : ""
        }
        confirmLabel="Премахни"
        danger={true}
        busy={pendingRemoval !== null && busyId === pendingRemoval.id}
        onCancel={() => {
          if (busyId === null) setPendingRemoval(null)
        }}
        onConfirm={() => {
          if (pendingRemoval) {
            const plugin = pendingRemoval
            setPendingRemoval(null)
            void runAction(plugin, "uninstall")
          }
        }}
      />
    </AdminShell>
  )
}
