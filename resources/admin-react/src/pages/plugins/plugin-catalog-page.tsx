import { useEffect, useState } from "react"
import { ArrowDownToLine, Eye, PackageOpen, Power } from "lucide-react"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import type { PluginCatalogRecord } from "@/lib/admin-types"
import { toast } from "sonner"

type PluginCatalogPageProps = { onLogout: () => void; onNavigate: (label: string) => void; onBack: () => void; onView: (id: string) => void; loggingOut: boolean }
type CatalogAction = "install" | "activate" | "deactivate"

export function PluginCatalogPage({ onLogout, onNavigate, onBack, onView, loggingOut }: PluginCatalogPageProps) {
  const [catalog, setCatalog] = useState<PluginCatalogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<{ id: string; action: CatalogAction } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/plugins/catalog", { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { catalog?: PluginCatalogRecord[]; error?: { message?: string } }
        if (!response.ok) throw new Error(body.error?.message ?? "Каталогът не можа да бъде зареден.")
        if (!cancelled) setCatalog(body.catalog ?? [])
      })
      .catch((reason) => { if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Каталогът не можа да бъде зареден.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function install(plugin: PluginCatalogRecord) {
    if (busyAction !== null) return
    setBusyAction({ id: plugin.id, action: "install" })
    try {
      const token = await getCsrfToken()
      const action = plugin.installation_status === "not_installed" ? "install_remote" : "update_remote"
      const response = await fetch("/api/plugins/action", { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ id: plugin.id, action }) })
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? "Инсталирането не можа да бъде изпълнено.")
      setCatalog((current) => current.map((item) => item.id === plugin.id ? { ...item, installation_status: item.installation_status === "active" ? "active" : "inactive", installed_version: item.version, update_available: false } : item))
      toast.success(action === "install_remote" ? "Разширението е инсталирано." : "Разширението е обновено.")
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Инсталирането не можа да бъде изпълнено.") }
    finally { setBusyAction(null) }
  }

  async function changeStatus(plugin: PluginCatalogRecord, action: "activate" | "deactivate") {
    if (busyAction !== null) return
    setBusyAction({ id: plugin.id, action })
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/plugins/action", { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ id: plugin.id, action }) })
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? "Статусът не можа да бъде променен.")
      setCatalog((current) => current.map((item) => item.id === plugin.id ? { ...item, installation_status: action === "activate" ? "active" : "inactive" } : item))
      toast.success(action === "activate" ? "Разширението е активирано." : "Разширението е деактивирано.")
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Статусът не можа да бъде променен.") }
    finally { setBusyAction(null) }
  }

  return <AdminShell title="Каталог с разширения" onLogout={onLogout} onNavigate={onNavigate} activeItem="Разширения" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>Каталог с разширения</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Разширения", onClick: onBack }, { label: "Каталог" }]} /></div><button type="button" onClick={onBack}>Назад към разширенията</button></div>
    {loading ? <div className="react-catalog-empty">Зареждане на каталога…</div> : catalog.length === 0 ? <div className="react-catalog-empty"><PackageOpen aria-hidden="true" /><strong>Няма публикувани разширения.</strong><span>Каталогът временно не съдържа достъпни пакети.</span></div> : <div className="plugin-catalog-grid">{catalog.map((plugin) => { const installed = plugin.installation_status !== "not_installed"; const active = plugin.installation_status === "active"; const statusAction: CatalogAction = active ? "deactivate" : "activate"; const isBusy = busyAction?.id === plugin.id; return <article className="plugin-catalog-card" key={plugin.id}><div className="plugin-catalog-card-head">{plugin.icon_url ? <img src={plugin.icon_url} alt="" /> : <div className="plugin-catalog-icon"><PackageOpen aria-hidden="true" /></div>}<div>{installed ? <button className="plugin-catalog-title-link" type="button" onClick={() => onView(plugin.id)}>{plugin.name}</button> : <h2>{plugin.name}</h2>}<span>{plugin.id}</span></div></div><p>{plugin.description || "Няма описание за това разширение."}</p><div className="plugin-catalog-meta"><span>Версия <strong>{plugin.version}</strong></span>{plugin.author && <span>Автор <strong>{plugin.author}</strong></span>}</div>{plugin.update_available && <div className="plugin-catalog-status"><span className="plugin-catalog-update">Има обновление</span></div>}<div className="plugin-catalog-actions">{installed && <button type="button" onClick={() => onView(plugin.id)} disabled={busyAction !== null}><Eye aria-hidden="true" />Преглед</button>}{installed && <LoadingButton type="button" loading={isBusy && busyAction?.action === statusAction} disabled={busyAction !== null} onClick={() => void changeStatus(plugin, statusAction)}><Power aria-hidden="true" />{active ? "Деактивирай" : "Активирай"}</LoadingButton>}<LoadingButton type="button" loading={isBusy && busyAction?.action === "install"} disabled={busyAction !== null || (installed && !plugin.update_available) || active} onClick={() => void install(plugin)}>{isBusy && busyAction?.action === "install" ? "Изчакване…" : !installed ? <><ArrowDownToLine aria-hidden="true" />Инсталирай</> : "Обнови"}</LoadingButton></div></article> })}</div>}
  </AdminShell>
}
