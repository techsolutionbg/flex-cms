import { useEffect, useState } from "react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { TableActionsMenu } from "@/components/table-actions-menu"
import { AdminShell } from "@/components/admin-shell"
import { getCsrfToken } from "@/lib/admin-api"
import type { UserRecord } from "@/lib/admin-types"
import { toast } from "sonner"

const roleLabels: Record<string, string> = { user: "Потребител", editor: "Редактор", admin: "Администратор", super_admin: "Супер администратор" }
const userStatusLabels: Record<string, string> = { active: "Активен", disabled: "Деактивиран" }
type UsersPageProps = { onLogout: () => void; onNavigate: (label: string) => void; onCreate: () => void; onEdit: (user: UserRecord) => void; loggingOut: boolean }

export function UsersPage({ onLogout, onNavigate, onCreate, onEdit, loggingOut }: UsersPageProps) {
  const query = new URLSearchParams(window.location.search)
  const [view, setView] = useState<"active" | "trash">(query.get("view") === "trash" ? "trash" : "active")
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(query.get("search") ?? "")
  const [roleFilter, setRoleFilter] = useState(query.get("role") ?? "all")
  const [statusFilter, setStatusFilter] = useState(query.get("status") ?? "all")
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/users?view=${view}`, { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (response) => { const body = await response.json().catch(() => ({})) as { users?: UserRecord[]; error?: { message?: string } }; if (!response.ok) throw new Error(body.error?.message ?? "Потребителите не можаха да бъдат заредени."); if (!cancelled) setUsers(body.users ?? []) })
      .catch((reason) => { if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Потребителите не можаха да бъдат заредени.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [view])

  useEffect(() => { const params = new URLSearchParams(); if (view === "trash") params.set("view", "trash"); if (search) params.set("search", search); if (roleFilter !== "all") params.set("role", roleFilter); if (statusFilter !== "all") params.set("status", statusFilter); window.history.replaceState(null, "", params.toString() ? `/users?${params}` : "/users") }, [roleFilter, search, statusFilter, view])

  const filteredUsers = users.filter((user) => (roleFilter === "all" || user.role === roleFilter) && (statusFilter === "all" || user.status === statusFilter) && `${user.name} ${user.email}`.toLocaleLowerCase("bg").includes(search.toLocaleLowerCase("bg")))
  const activeFilterCount = (search ? 1 : 0) + (roleFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)
  function clearFilters() { setSearch(""); setRoleFilter("all"); setStatusFilter("all") }

  async function request(user: UserRecord, method: "POST" | "DELETE", path: string, success: string) {
    if (busyId !== null) return
    if (path === "/force" && !window.confirm(`Потребителят „${user.name}“ ще бъде изтрит завинаги. Продължавате ли?`)) return
    setBusyId(user.id)
    try { const token = await getCsrfToken(); const response = await fetch(`/api/users/${user.id}${path}`, { method, credentials: "include", headers: { Accept: "application/json", "X-CSRF-Token": token } }); const body = await response.json().catch(() => ({})) as { error?: { message?: string } }; if (!response.ok) throw new Error(body.error?.message ?? "Операцията не можа да бъде изпълнена."); toast.success(success); setUsers((current) => current.filter((item) => item.id !== user.id)) } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Операцията не можа да бъде изпълнена.") } finally { setBusyId(null) }
  }

  async function updateStatus(user: UserRecord) {
    if (busyId !== null) return
    setBusyId(user.id)
    try { const token = await getCsrfToken(); const nextStatus = user.status === "active" ? "disabled" : "active"; const response = await fetch(`/api/users/${user.id}`, { method: "PATCH", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ name: user.name, email: user.email, role: user.role, status: nextStatus }) }); const body = await response.json().catch(() => ({})) as { user?: UserRecord; error?: { message?: string } }; if (!response.ok || !body.user) throw new Error(body.error?.message ?? "Статусът не можа да бъде променен."); setUsers((current) => current.map((item) => item.id === user.id ? body.user as UserRecord : item)); toast.success(nextStatus === "active" ? "Потребителят е активиран." : "Потребителят е деактивиран.") } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Статусът не можа да бъде променен.") } finally { setBusyId(null) }
  }

  const columns: DataTableColumn<UserRecord>[] = [
    { key: "name", label: "Име", sortable: true, render: (user) => <><a className="react-page-link" href={`/users/${user.id}/edit`} onClick={(event) => { event.preventDefault(); onEdit(user) }}>{user.name}</a><small>{user.email}</small></> },
    { key: "role", label: "Роля", sortable: true, render: (user) => roleLabels[user.role] ?? user.role },
    { key: "status", label: "Статус", sortable: true, render: (user) => <span className={`react-status-badge ${user.status === "active" ? "status-published" : "status-draft"}`}><span className="status-dot" />{userStatusLabels[user.status] ?? user.status}</span> },
    { key: "actions", label: "Действия", render: (user) => <TableActionsMenu><DropdownOption onClick={() => onEdit(user)}>Редактирай</DropdownOption>{view === "active" ? <>{!["admin", "super_admin"].includes(user.role) && <DropdownOption onClick={() => void request(user, "POST", "/trash", "Потребителят е преместен в кошчето.")}>Премести в кошчето</DropdownOption>}{user.role !== "super_admin" && <DropdownOption onClick={() => void updateStatus(user)}>{busyId === user.id ? "Изчакване…" : user.status === "active" ? "Деактивирай" : "Активирай"}</DropdownOption>}</> : <><DropdownOption onClick={() => void request(user, "POST", "/restore", "Потребителят е възстановен.")}>Възстанови</DropdownOption><DropdownOption danger onClick={() => void request(user, "DELETE", "/force", "Потребителят е изтрит завинаги.")}>Изтрий завинаги</DropdownOption></>}</TableActionsMenu> },
  ]

  return <AdminShell title={view === "trash" ? "Кошче за потребители" : "Потребители"} onLogout={onLogout} onNavigate={onNavigate} activeItem="Потребители" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>{view === "trash" ? "Кошче за потребители" : "Потребители"}</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: view === "trash" ? "Кошче за потребители" : "Потребители" }]} /></div><button type="button" onClick={onCreate} disabled={view === "trash"}>Нов потребител</button></div>
    <DataTable filterStorageKey="users" data={filteredUsers} columns={columns} rowKey={(user) => user.id} loading={loading} toolbar={<><label className="react-filter-field"><span>Търсене</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Име или имейл" /></label><label className="react-filter-field"><span>Роля</span><DropdownMenu ariaLabel="Избор на роля" triggerClassName="react-filter-trigger" trigger={<><span>{roleFilter === "all" ? "Всички роли" : roleLabels[roleFilter]}</span><DropdownChevron /></>}><DropdownOption selected={roleFilter === "all"} onClick={() => setRoleFilter("all")}>Всички роли</DropdownOption>{Object.entries(roleLabels).map(([value, label]) => <DropdownOption key={value} selected={roleFilter === value} onClick={() => setRoleFilter(value)}>{label}</DropdownOption>)}</DropdownMenu></label><label className="react-filter-field"><span>Статус</span><DropdownMenu ariaLabel="Избор на статус" triggerClassName="react-filter-trigger" trigger={<><span>{statusFilter === "all" ? "Всички статуси" : userStatusLabels[statusFilter]}</span><DropdownChevron /></>}><DropdownOption selected={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Всички статуси</DropdownOption><DropdownOption selected={statusFilter === "active"} onClick={() => setStatusFilter("active")}>Активни</DropdownOption><DropdownOption selected={statusFilter === "disabled"} onClick={() => setStatusFilter("disabled")}>Деактивирани</DropdownOption></DropdownMenu></label><label className="react-filter-field"><span>Изглед</span><DropdownMenu ariaLabel="Избор на изглед" triggerClassName="react-filter-trigger" trigger={<><span>{view === "trash" ? "Кошче" : "Активни потребители"}</span><DropdownChevron /></>}><DropdownOption selected={view === "active"} onClick={() => setView("active")}>Активни потребители</DropdownOption><DropdownOption selected={view === "trash"} onClick={() => setView("trash")}>Кошче</DropdownOption></DropdownMenu></label><button className="react-filter-clear" type="button" onClick={clearFilters} disabled={activeFilterCount === 0}>Изчисти филтрите</button><span className="react-filter-count">{activeFilterCount ? `${activeFilterCount} приложени филтъра` : "Без филтри"}</span></>} />
  </AdminShell>
}
