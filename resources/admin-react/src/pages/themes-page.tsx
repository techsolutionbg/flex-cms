import { useEffect, useState } from "react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { AdminShell } from "@/components/admin-shell"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import type { ThemeRecord } from "@/lib/admin-types"
import { toast } from "sonner"

type ThemeAction = "activate" | "deactivate" | "delete"
type ThemesPageProps = { onLogout: () => void; onNavigate: (label: string) => void; loggingOut: boolean }

export function ThemesPage({ onLogout, onNavigate, loggingOut }: ThemesPageProps) {
  const [themes, setThemes] = useState<ThemeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function loadThemes() {
    try {
      const response = await fetch("/api/admin/themes", { credentials: "include", headers: { Accept: "application/json" } })
      const body = await response.json().catch(() => ({})) as { themes?: ThemeRecord[]; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? "Темите не можаха да бъдат заредени.")
      setThemes(body.themes ?? [])
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Темите не можаха да бъдат заредени.") }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadThemes() }, [])

  async function runAction(theme: ThemeRecord, action: ThemeAction) {
    if (busyId !== null) return
    setBusyId(theme.id)
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/themes/action", { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ id: theme.id, action }) })
      const body = await response.json().catch(() => ({})) as { themes?: ThemeRecord[]; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? "Действието не можа да бъде изпълнено.")
      if (body.themes) setThemes(body.themes)
      else await loadThemes()
      toast.success(action === "activate" ? "Темата е активирана." : action === "deactivate" ? "Темата е деактивирана." : "Темата е изтрита.")
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Действието не можа да бъде изпълнено.") }
    finally { setBusyId(null) }
  }

  return <AdminShell title="Теми" onLogout={onLogout} onNavigate={onNavigate} activeItem="Теми" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>Теми</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Теми" }]} /></div></div>
    <section className="react-card">
      <div className="react-card-header"><h2>Инсталирани теми</h2><span>{themes.length} теми</span></div>
      {loading ? <p>Зареждане…</p> : themes.length === 0 ? <p>Няма открити теми.</p> : <div className="react-stack-list">{themes.map((theme) => { const busy = busyId === theme.id; return <article className="react-list-item" key={theme.id}><div><h3>{theme.name}</h3><p>{theme.description || "Без описание."}</p><small>{theme.id} · версия {theme.version}{theme.update_available ? ` · нова версия ${theme.available_version}` : ""}</small>{theme.error && <small className="react-error-text">{theme.error}</small>}</div><div className="react-button-row"><span className={`react-status-badge status-${theme.active ? "active" : "inactive"}`}><span className="status-dot" />{theme.active ? "Активна" : "Неактивна"}</span>{theme.valid && !theme.active && <LoadingButton type="button" disabled={busy} onClick={() => void runAction(theme, "activate")}>{busy && <span className="react-button-spinner" />}Активирай</LoadingButton>}{theme.active && <LoadingButton type="button" disabled={busy} onClick={() => void runAction(theme, "deactivate")}>{busy && <span className="react-button-spinner" />}Деактивирай</LoadingButton>}</div></article>})}</div>}
    </section>
  </AdminShell>
}
