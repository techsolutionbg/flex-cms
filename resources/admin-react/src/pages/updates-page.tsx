import { useEffect, useState } from "react"
import { CheckCircle2, History, RefreshCw, RotateCcw, Server, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import type { PlatformUpdateHistory, PlatformUpdateRemote } from "@/lib/admin-types"

type UpdatesPageProps = { onLogout: () => void; onNavigate: (label: string) => void; loggingOut: boolean }
type UpdateAction = "update_remote" | "rollback"

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("bg-BG")
}

export function UpdatesPage({ onLogout, onNavigate, loggingOut }: UpdatesPageProps) {
  const [version, setVersion] = useState<string | null>(null)
  const [remote, setRemote] = useState<PlatformUpdateRemote | null>(null)
  const [history, setHistory] = useState<PlatformUpdateHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<UpdateAction | null>(null)
  const [pendingRollback, setPendingRollback] = useState<PlatformUpdateHistory | null>(null)

  async function load() {
    const response = await fetch("/api/admin/updates", { credentials: "include", headers: { Accept: "application/json" } })
    const body = await response.json().catch(() => ({})) as { version?: string; remote_update?: PlatformUpdateRemote; history?: PlatformUpdateHistory[]; error?: { message?: string } }
    if (!response.ok) throw new Error(body.error?.message ?? "Данните за обновяванията не можаха да бъдат заредени.")
    setVersion(body.version ?? null)
    setRemote(body.remote_update ?? null)
    setHistory(body.history ?? [])
  }

  useEffect(() => {
    load().catch((reason) => toast.error(reason instanceof Error ? reason.message : "Данните за обновяванията не можаха да бъдат заредени.")).finally(() => setLoading(false))
  }, [])

  async function runAction(action: UpdateAction, payload: Record<string, unknown> = {}) {
    if (busyAction !== null) return
    setBusyAction(action)
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/admin/updates/action", { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ action, ...payload }) })
      const body = await response.json().catch(() => ({})) as { message?: string; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? "Операцията по обновяване не можа да бъде изпълнена.")
      toast.success(body.message ?? "Операцията завърши успешно.")
      await load()
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Операцията по обновяване не можа да бъде изпълнена.")
    } finally {
      setBusyAction(null)
    }
  }

  return <AdminShell title="Обновявания" onLogout={onLogout} onNavigate={onNavigate} activeItem="Обновявания" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>Обновявания</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Обновявания" }]} /></div></div>
    {loading ? <div className="react-empty-state">Зареждане на обновяванията…</div> : <div className="updates-page-grid">
      <CollapsibleSection title="Състояние на платформата" icon={Server} storageKey="updates-platform-status" className="updates-platform-status">
        <div className="updates-summary-card"><div className="updates-summary-icon"><Server aria-hidden="true" /></div><div><span className="react-eyebrow">Текуща версия</span><strong>{version ?? "—"}</strong><span>Канал: {remote?.channel ?? "stable"}</span></div></div>
        <div className={"updates-available-card" + (remote?.available ? " is-available" : "")}>
          {remote?.error ? <><TriangleAlert aria-hidden="true" /><div><h2>Проверката не бе успешна</h2><p>{remote.error}</p></div></> : remote?.available ? <><div className="updates-available-mark">NEW</div><div className="updates-available-content"><div className="updates-available-heading"><span className="react-eyebrow">Налична актуализация</span><h2>Версия {remote.available.version}</h2></div><p>{remote.available.release_notes || "Няма допълнителни бележки за релийза."}</p><small>Публикувана: {formatDate(remote.available.published_at)} · {formatBytes(remote.available.size)}</small><div className="updates-actions"><LoadingButton className="react-secondary-button" type="button" loading={busyAction === "update_remote"} disabled={busyAction !== null} onClick={() => void runAction("update_remote")}>Обнови сега</LoadingButton></div></div></> : <><CheckCircle2 aria-hidden="true" /><div><h2>Платформата е актуална</h2><p>Няма налична съвместима актуализация за текущия канал.</p></div></>}
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="История на обновяванията" icon={History} storageKey="updates-history" className="updates-section">
        {history.length === 0 ? <p className="react-muted">Все още няма записана история.</p> : <div className="updates-history-list">{history.map((record, index) => <div className="updates-history-row" key={(record.id ?? "record") + "-" + index}><div><strong>{record.type === "platform_rollback" ? "Rollback" : "Обновяване " + (record.from ?? "—") + " → " + (record.to ?? "—")}</strong><small>{formatDate(record.updated_at ?? record.rolled_back_at)}</small></div>{record.type === "platform" && record.id && record.to === version && <LoadingButton type="button" loading={busyAction === "rollback"} disabled={busyAction !== null} onClick={() => setPendingRollback(record)}><RotateCcw aria-hidden="true" />Върни назад</LoadingButton>}</div>)}</div>}
      </CollapsibleSection>
    </div>}
    <ConfirmDialog open={pendingRollback !== null} title="Връщане към предишна версия" message={pendingRollback ? "Платформата ще бъде върната от версия " + pendingRollback.to + " към " + pendingRollback.from + "." : ""} confirmLabel="Върни назад" danger={true} busy={busyAction === "rollback"} onCancel={() => { if (busyAction === null) setPendingRollback(null) }} onConfirm={() => { if (pendingRollback?.id) { const id = pendingRollback.id; setPendingRollback(null); void runAction("rollback", { id }) } }} />
  </AdminShell>
}
