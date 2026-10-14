import { t } from "@/lib/admin-i18n"
import { adminPluginPath, adminUrl } from "@/lib/admin-routes"
import { useEffect, useState } from "react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { AdminShell } from "@/components/admin-shell"
import { useWorkspacePanelActive } from "@/components/admin-workspace-context"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { LoadingButton } from "@/components/loading-button"
import { TableActionsMenu } from "@/components/table-actions-menu"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { getCsrfToken } from "@/lib/admin-api"
import type { PluginRecord } from "@/lib/admin-types"
import {
  fetchAdminPlugins,
  invalidateAdminPluginsCache,
  readCachedAdminPlugins,
  writeCachedAdminPlugins,
} from "@/lib/admin-plugins-api"
import { bulkTargets, type PluginBulkAction } from "@/lib/plugin-bulk"
import { toast } from "sonner"

const statusLabels: Record<string, string> = {
  active: "Active",
  installed: "Installed",
  inactive: "Inactive",
  error: "Error",
  discovered: "Not installed status",
}
type PluginAction = PluginBulkAction
const bulkLabels: Record<PluginAction, { label: string; running: string; done: string }> = {
  install: { label: "Инсталирай", running: "Инсталиране", done: "инсталирани" },
  activate: { label: "Активирай", running: "Активиране", done: "активирани" },
  deactivate: { label: "Деактивирай", running: "Деактивиране", done: "деактивирани" },
  update_remote: { label: "Обнови", running: "Обновяване", done: "обновени" },
  uninstall: { label: "Премахни", running: "Премахване", done: "премахнати" },
}
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
  const isActivePanel = useWorkspacePanelActive()
  const [plugins, setPlugins] = useState<PluginRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(query.get("search") ?? "")
  const [statusFilter, setStatusFilter] = useState(query.get("status") ?? "all")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<PluginRecord | null>(null)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string | number>>(new Set())
  const [bulk, setBulk] = useState<{ action: PluginAction; done: number; total: number } | null>(null)
  const [pendingBulkRemoval, setPendingBulkRemoval] = useState(false)
  const [hardRefreshing, setHardRefreshing] = useState(false)

  useEffect(() => {
    const abort = new AbortController()
    const cached = readCachedAdminPlugins()
    if (cached) {
      setPlugins(cached)
      setLoading(false)
    }
    fetchAdminPlugins({ signal: abort.signal, force: !!cached })
      .then((plugins) => {
        if (!abort.signal.aborted) setPlugins(plugins)
      })
      .catch((reason) => {
        if (abort.signal.aborted) return
        if (!cached)
          toast.error(
            reason instanceof Error ? reason.message : "Разширенията не можаха да бъдат заредени.",
          )
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [])

  useEffect(() => {
    if (!isActivePanel) return
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter !== "all") params.set("status", statusFilter)
    window.history.replaceState(
      null,
      "",
      `${adminUrl("/plugins")}${params.toString() ? `?${params}` : ""}`,
    )
  }, [isActivePanel, search, statusFilter])

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

  async function hardRefreshFromServer() {
    if (hardRefreshing || bulk !== null || busyId !== null) return
    setHardRefreshing(true)
    invalidateAdminPluginsCache()
    setLoading(true)
    try {
      setPlugins(await fetchAdminPlugins({ force: true, refresh: true }))
      toast.success("Списъкът е презареден от сървъра.")
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Разширенията не можаха да бъдат презаредени.",
      )
    } finally {
      setHardRefreshing(false)
      setLoading(false)
    }
  }

  /** Runs one action on the server and puts the result into the list. */
  async function performAction(plugin: PluginRecord, action: PluginAction) {
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
    setPlugins((current) => {
      const next =
        action === "uninstall"
          ? current.filter((item) => item.id !== plugin.id)
          : body.plugin
            ? current.map((item) => (item.id === plugin.id ? body.plugin! : item))
            : current
      writeCachedAdminPlugins(next)
      return next
    })
  }

  async function runAction(plugin: PluginRecord, action: PluginAction) {
    if (busyId !== null || bulk !== null) return
    setBusyId(plugin.id)
    try {
      await performAction(plugin, action)
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
      if (action === "uninstall") {
        setSelectedIds((current) => {
          if (!current.has(plugin.id)) return current
          const next = new Set(current)
          next.delete(plugin.id)
          return next
        })
      }
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Действието не можа да бъде изпълнено.",
      )
    } finally {
      setBusyId(null)
    }
  }

  // Selected plugins that are visible with the current filters.
  const selectedPlugins = filteredPlugins.filter((plugin) => selectedIds.has(plugin.id))

  /**
   * Runs the action on every selected plugin it applies to, one after another, so each one installs, migrates
   * and boots as on its own. Plugins others require are handled first (last when deactivating or removing).
   */
  async function runBulk(action: PluginAction) {
    if (busyId !== null || bulk !== null) return
    const targets = bulkTargets(action, selectedPlugins)
    if (targets.length === 0) return
    const failures: { id: string; name: string; message: string }[] = []
    setBulk({ action, done: 0, total: targets.length })
    for (const [index, plugin] of targets.entries()) {
      setBusyId(plugin.id)
      try {
        await performAction(plugin, action)
      } catch (reason) {
        failures.push({
          id: plugin.id,
          name: plugin.name,
          message: reason instanceof Error ? reason.message : "Действието не можа да бъде изпълнено.",
        })
      }
      setBulk({ action, done: index + 1, total: targets.length })
    }
    setBusyId(null)
    setBulk(null)
    const succeeded = targets.length - failures.length
    // Plugins that failed stay selected, so the action can be tried again after fixing the cause.
    const failedIds = new Set(failures.map((failure) => failure.id))
    setSelectedIds(failedIds)
    if (succeeded > 0)
      toast.success(
        t("{count} extensions: {status}.", "core", {
          count: succeeded,
          status: t(bulkLabels[action].done),
        }),
      )
    if (failures.length > 0)
      toast.error(t("{count} extensions could not be processed.", "core", { count: failures.length }), {
        description: failures.map((failure) => `${failure.name}: ${failure.message}`).join("\n"),
      })
  }
  const bulkCount = (action: PluginAction) => bulkTargets(action, selectedPlugins).length

  const columns: DataTableColumn<PluginRecord>[] = [
    {
      key: "name",
      label: "Име",
      sortable: true,
      render: (plugin) => (
        <>
          <a
            className="react-page-link"
            href={adminUrl(adminPluginPath(plugin.id))}
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
              onView(plugin)
            }}
          >
            {plugin.name}
          </a>
          <small className="react-table-subtext">{plugin.id}</small>
        </>
      ),
      sortValue: (plugin) => plugin.name,
    },
    {
      key: "version",
      label: "Версия",
      sortable: true,
      render: (plugin) => (
        <>
          {plugin.version}
          {plugin.update_available && (
            <small className="react-table-update">{t("New:")} {plugin.available_version}</small>
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
          {t(statusLabels[plugin.status] ?? plugin.status)}
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

              {t("Preview")}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy || !plugin.update_available}
              onClick={() => void runAction(plugin, "update_remote")}
            >
              {busy && <span className="react-button-spinner" />}{t("Update")}
            </button>
            {plugin.status === "active" ? (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void runAction(plugin, "deactivate")}
              >
                {busy && <span className="react-button-spinner" />}{t("Deactivate")}
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => void runAction(plugin, "activate")}
              >
                {busy && <span className="react-button-spinner" />}{t("Activate")}
              </button>
            )}
            <button
              className="is-danger"
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => setPendingRemoval(plugin)}
            >

              {t("Remove")}
            </button>
          </TableActionsMenu>
        )
      },
    },
  ]

  return (
    <AdminShell
      title={t("Extensions")}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Разширения"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{t("Extensions")}</h1>
          <p className="react-page-lead">{t("Installed extensions on this site. Find new ones in the extension catalog.")}</p>
          <Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Разширения" }]} />
        </div>
        <div className="react-page-heading-actions">
          <LoadingButton
            type="button"
            loading={hardRefreshing}
            disabled={loading && !hardRefreshing}
            onClick={() => void hardRefreshFromServer()}
          >

            {t("Refresh")}
          </LoadingButton>
          <button type="button" onClick={onCatalog}>

            {t("Extension catalog")}
          </button>
        </div>
      </div>
      <DataTable
        extensionPoint="plugins.list"
        filterStorageKey="plugins"
        data={filteredPlugins}
        columns={columns}
        rowKey={(plugin) => plugin.id}
        loading={loading}
        selectable
        selectedKeys={selectedIds}
        onSelectionChange={setSelectedIds}
        bulkActions={
          <>
            <strong>
              {bulk
                ? t("{action}: {current} of {total}…", "core", {
                    action: t(bulkLabels[bulk.action].running),
                    current: bulk.done + 1 > bulk.total ? bulk.total : bulk.done + 1,
                    total: bulk.total,
                  })
                : t("{count} selected", "core", { count: selectedPlugins.length })}
            </strong>
            {(["activate", "deactivate", "update_remote"] as const).map((action) => (
              <LoadingButton
                key={action}
                type="button"
                loading={bulk?.action === action}
                disabled={bulk !== null || busyId !== null || bulkCount(action) === 0}
                onClick={() => void runBulk(action)}
              >
                {t(bulkLabels[action].label)}
                {bulkCount(action) > 0 ? ` (${bulkCount(action)})` : ""}
              </LoadingButton>
            ))}
            <LoadingButton
              type="button"
              className="is-danger"
              loading={bulk?.action === "uninstall"}
              disabled={bulk !== null || busyId !== null || bulkCount("uninstall") === 0}
              onClick={() => setPendingBulkRemoval(true)}
            >

              {t("Remove")}{bulkCount("uninstall") > 0 ? ` (${bulkCount("uninstall")})` : ""}
            </LoadingButton>
          </>
        }
        emptyMessage={
          plugins.length === 0
            ? "Няма инсталирани разширения. Отворете каталога, за да добавите."
            : "Няма разширения, отговарящи на филтрите."
        }
        toolbar={
          <>
            <label className="react-filter-field">
              <span>{t("Search")}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Name, ID, or description")}
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
                      {statusFilter === "all" ? t("All statuses") : t(statusLabels[statusFilter])}
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
                {Object.entries(statusLabels).map(([value, label]) => (
                  <DropdownOption
                    key={value}
                    selected={statusFilter === value}
                    onClick={() => setStatusFilter(value)}
                  >
                    {t(label)}
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

              {t("Clear filters")}
            </LoadingButton>
            <span className="react-filter-count">
              {activeFilterCount ? `${activeFilterCount} приложени филтъра` : t("No filters")}
            </span>
          </>
        }
      />
      <ConfirmDialog
        open={pendingRemoval !== null}
        title={t("Uninstall extension")}
        message={
          pendingRemoval
            ? `Разширението „${pendingRemoval.name}“ ще бъде премахнато окончателно. Ако е активно, първо ще бъде деактивирано.`
            : ""
        }
        confirmLabel={t("Remove")}
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
      <ConfirmDialog
        open={pendingBulkRemoval}
        title={t("Uninstall extensions")}
        message={`${bulkTargets("uninstall", selectedPlugins)
          .map((plugin) => `„${plugin.name}“`)
          .join(", ")} ще бъдат премахнати окончателно. Активните първо ще бъдат деактивирани.`}
        confirmLabel={t("Remove")}
        danger={true}
        busy={bulk?.action === "uninstall"}
        onCancel={() => {
          if (bulk === null) setPendingBulkRemoval(false)
        }}
        onConfirm={() => {
          setPendingBulkRemoval(false)
          void runBulk("uninstall")
        }}
      />
    </AdminShell>
  )
}
