import { useEffect, useState } from "react"
import { ArrowDownToLine, Eye, PackageOpen, Power, Trash2, Upload } from "lucide-react"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import type { ThemeCatalogRecord } from "@/lib/admin-types"
import { adminUrl } from "@/lib/admin-routes"
import { toast } from "sonner"

type ThemeStorePageProps = { onLogout: () => void; onNavigate: (label: string) => void; onBack: () => void; loggingOut: boolean }
type StoreAction = "install" | "activate" | "delete"

export function ThemeStorePage({ onLogout, onNavigate, onBack, loggingOut }: ThemeStorePageProps) {
  const [catalog, setCatalog] = useState<ThemeCatalogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<{ id: string; action: StoreAction } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/themes/catalog", { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { catalog?: ThemeCatalogRecord[]; error?: { message?: string } }
        if (!response.ok) throw new Error(body.error?.message ?? "Каталогът не можа да бъде зареден.")
        if (!cancelled) setCatalog(body.catalog ?? [])
      })
      .catch((reason) => { if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Каталогът не можа да бъде зареден.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  async function runAction(theme: ThemeCatalogRecord, action: StoreAction) {
    if (busyAction !== null) return
    setBusyAction({ id: theme.id, action })
    try {
      const token = await getCsrfToken()
      const remoteAction = action === "install" ? (theme.installed ? "update_remote" : "install_remote") : action === "delete" ? "delete" : "activate"
      const response = await fetch("/api/themes/action", { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ id: theme.id, action: remoteAction }) })
      const body = await response.json().catch(() => ({})) as { error?: { message?: string }; themes?: Array<{ id: string; version: string; active: boolean }> }
      if (!response.ok) throw new Error(body.error?.message ?? "Действието не можа да бъде изпълнено.")
      const updated = body.themes?.find((item) => item.id === theme.id)
      if (action !== "delete" && !updated) throw new Error("Сървърът не потвърди, че темата присъства сред инсталираните файлове. Презаредете каталога и проверете папката за теми.")
      setCatalog((current) => current.map((item) => item.id === theme.id ? {
        ...item,
        installed: action !== "delete" && Boolean(updated),
        active: action !== "delete" && (updated?.active ?? false),
        installed_version: action === "delete" ? null : updated?.version ?? null,
        update_available: false,
      } : item))
      toast.success(remoteAction === "install_remote" ? "Темата е инсталирана." : remoteAction === "update_remote" ? "Темата е обновена." : remoteAction === "delete" ? "Темата е деинсталирана." : "Темата е активирана.")
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Действието не можа да бъде изпълнено.") }
    finally { setBusyAction(null) }
  }

  return <AdminShell title="Каталог с теми" onLogout={onLogout} onNavigate={onNavigate} activeItem="Теми" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>Каталог с теми</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Теми", onClick: onBack }, { label: "Каталог" }]} /></div><button type="button" onClick={onBack}>Назад към темите</button></div>
    {loading ? <div className="react-catalog-empty">Зареждане на каталога…</div> : catalog.length === 0 ? <div className="react-catalog-empty"><PackageOpen aria-hidden="true" /><strong>Няма публикувани теми.</strong><span>Каталогът временно не съдържа достъпни теми.</span></div> : <div className="theme-store-grid">{catalog.map((theme) => {
      const busy = busyAction?.id === theme.id
      const installed = theme.installed
      return <article className="theme-store-card" key={theme.id}>
        <div className="theme-store-preview">{theme.screenshot_url ? <img src={theme.screenshot_url} alt={`Преглед на ${theme.name}`} /> : <img src="/theme-placeholder.png" alt="" />}</div>
        <div className="theme-store-body"><div className="theme-store-title"><div><h2>{theme.name}</h2><span>{theme.id}</span></div><span className={`react-status-badge status-${theme.active ? "active" : installed ? "installed" : "inactive"}`}><span className="status-dot" />{theme.active ? "Активна" : installed ? "Инсталирана" : "Неинсталирана"}</span></div>
          <p>{theme.description || "Няма описание за тази тема."}</p>
          <div className="theme-store-meta"><span>Версия <strong>{theme.version}</strong></span>{theme.author && <span>Автор <strong>{theme.author}</strong></span>}</div>
          {theme.tags && theme.tags.length > 0 && <div className="theme-card-tags">{theme.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
          {theme.update_available && <div className="theme-card-update">Налична е нова версия</div>}
          {theme.release_notes && <div className="theme-card-notes"><strong>Какво ново</strong><span>{theme.release_notes}</span></div>}
        </div>
        <div className="theme-store-actions"><a className="theme-card-button" href={`/admin/themes/${encodeURIComponent(theme.id)}/preview`} target="_blank" rel="noopener"><Eye aria-hidden="true" />Преглед</a>{installed && !theme.active && <LoadingButton type="button" loading={busy && busyAction?.action === "activate"} disabled={busyAction !== null} onClick={() => void runAction(theme, "activate")}><Power aria-hidden="true" />Активирай</LoadingButton>}<LoadingButton type="button" loading={busy && busyAction?.action === "install"} disabled={busyAction !== null} onClick={() => void runAction(theme, "install")}>{installed ? <><Upload aria-hidden="true" />{theme.update_available ? "Обнови" : "Преинсталирай"}</> : <><ArrowDownToLine aria-hidden="true" />Инсталирай</>}</LoadingButton>{installed && !theme.active && <LoadingButton type="button" loading={busy && busyAction?.action === "delete"} disabled={busyAction !== null} onClick={() => { if (window.confirm(`Да бъде ли деинсталирана темата „${theme.name}“?`)) void runAction(theme, "delete") }}><Trash2 aria-hidden="true" />Деинсталирай</LoadingButton>}</div>
      </article>
    })}</div>}
  </AdminShell>
}
