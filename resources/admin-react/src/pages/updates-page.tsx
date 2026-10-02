import { useEffect, useState } from "react"
import { Archive, CheckCircle2, History, LoaderCircle, RotateCcw, Server, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import type { PlatformRelease, PlatformUpdateHistory, PlatformUpdateJob, PlatformUpdateRemote } from "@/lib/admin-types"

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
  const [releases, setReleases] = useState<PlatformRelease[]>([])
  const [history, setHistory] = useState<PlatformUpdateHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<UpdateAction | null>(null)
  const [busyReleaseVersion, setBusyReleaseVersion] = useState<string | null>(null)
  const [updateQueued, setUpdateQueued] = useState(false)
  const [updateJobId, setUpdateJobId] = useState<string | null>(null)
  const [updateReconnecting, setUpdateReconnecting] = useState(false)
  const [pendingRollback, setPendingRollback] = useState<PlatformUpdateHistory | null>(null)
  const [pendingRelease, setPendingRelease] = useState<PlatformRelease | null>(null)

  async function load() {
    const response = await fetch("/api/admin/updates", { credentials: "include", headers: { Accept: "application/json" } })
    const body = await response.json().catch(() => ({})) as { version?: string; remote_update?: PlatformUpdateRemote; releases?: PlatformRelease[]; history?: PlatformUpdateHistory[]; error?: { message?: string } }
    if (!response.ok) throw new Error(body.error?.message ?? "Данните за обновяванията не можаха да бъдат заредени.")
    setVersion(body.version ?? null)
    setRemote(body.remote_update ?? null)
    setReleases(body.releases ?? [])
    setHistory(body.history ?? [])
  }

  useEffect(() => {
    load().catch((reason) => toast.error(reason instanceof Error ? reason.message : "Данните за обновяванията не можаха да бъдат заредени.")).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!updateQueued || !updateJobId) return
    let cancelled = false
    let timer: number | null = null

    const wait = (milliseconds: number) => new Promise<void>((resolve) => {
      timer = window.setTimeout(resolve, milliseconds)
    })

    const poll = async () => {
      let delay = 1500

      while (!cancelled) {
      try {
        const response = await fetch("/api/admin/updates", { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" })
        const body = await response.json().catch(() => ({})) as { update_jobs?: PlatformUpdateJob[] }
        const job = (body.update_jobs ?? []).find((item) => item.id === updateJobId)
        if (!response.ok || !job || job.status === "pending" || job.status === "running") {
          setUpdateReconnecting(false)
          await wait(delay)
          continue
        }
        if (job.status === "failed") {
          setUpdateQueued(false)
          setUpdateJobId(null)
          setUpdateReconnecting(false)
          toast.error(job.error ?? "Обновяването не беше успешно.")
          await load()
        } else if (job.status === "completed") {
          // The updater replaces the application while the browser is still
          // open. Wait for a successful response from the new process before
          // reloading, otherwise Chromium briefly shows ERR_EMPTY_RESPONSE.
          for (let attempt = 0; attempt < 12 && !cancelled; attempt += 1) {
            try {
              const ready = await fetch("/api/admin/updates", { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" })
              if (ready.ok) {
                await wait(300)
                if (!cancelled) {
                  setUpdateQueued(false)
                  setUpdateJobId(null)
                  setUpdateReconnecting(false)
                  window.location.reload()
                }
                return
              }
            } catch {}
            setUpdateReconnecting(true)
            await wait(Math.min(1000 + attempt * 500, 4000))
          }
          setUpdateQueued(false)
          setUpdateJobId(null)
          setUpdateReconnecting(false)
        }
      } catch {
        // The updater may briefly restart the application while replacing files.
        // Keep the current document alive and retry instead of navigating into
        // the short window where the server has no response.
        setUpdateReconnecting(true)
        await wait(delay)
        delay = Math.min(Math.round(delay * 1.5), 5000)
      }
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [updateQueued, updateJobId])

  async function runAction(action: UpdateAction, payload: Record<string, unknown> = {}) {
    if (busyAction !== null) return
    setBusyAction(action)
    const requestedVersion = typeof payload.version === "string" ? payload.version : null
    if (action === "update_remote" && requestedVersion !== null) setBusyReleaseVersion(requestedVersion)
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/admin/updates/action", { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": token }, body: JSON.stringify({ action, ...payload }) })
      const body = await response.json().catch(() => ({})) as { message?: string; job_id?: string; error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? "Операцията по обновяване не можа да бъде изпълнена.")
      if (action === "update_remote") { setUpdateQueued(true); setUpdateJobId(body.job_id ?? null) }
      toast.success(body.message ?? "Операцията завърши успешно.")
      // The updater replaces the running platform asynchronously. Avoid an
      // immediate follow-up request while maintenance mode may be starting.
      if (action !== "update_remote") await load()
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Операцията по обновяване не можа да бъде изпълнена.")
    } finally {
      if (action === "update_remote") setBusyReleaseVersion(null)
      setBusyAction(null)
    }
  }

  return <AdminShell title="Обновявания" onLogout={onLogout} onNavigate={onNavigate} activeItem="Обновявания" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>Обновявания</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Обновявания" }]} /></div></div>
    {loading ? <div className="react-empty-state">Зареждане на обновяванията…</div> : <div className="updates-page-grid">
      <CollapsibleSection title="Състояние на платформата" icon={Server} storageKey="updates-platform-status" className="updates-platform-status">
        <div className="updates-summary-card"><div className="updates-summary-icon"><Server aria-hidden="true" /></div><div><span className="react-eyebrow">Текуща версия</span><strong>{version ?? "—"}</strong><span>Канал: {remote?.channel ?? "stable"}</span></div></div>
        {updateQueued && <div className="updates-progress-card" role="status" aria-live="polite"><LoaderCircle className="updates-progress-spinner" aria-hidden="true" /><div><strong>{updateReconnecting ? "Свързване с платформата…" : "Обновяването се изпълнява…"}</strong><p>{updateReconnecting ? "Платформата се рестартира след обновяването. Изчакваме връзката да бъде възстановена." : "Версията е поставена в опашката и се обработва от updater процеса."}</p></div></div>}
        <div className={"updates-available-card" + (remote?.available ? " is-available" : "")}>
          {remote?.error ? <><TriangleAlert aria-hidden="true" /><div><h2>Проверката не бе успешна</h2><p>{remote.error}</p></div></> : remote?.available ? <><div className="updates-available-mark">NEW</div><div className="updates-available-content"><div className="updates-available-heading"><span className="react-eyebrow">Налична актуализация</span><h2>Версия {remote.available.version}</h2></div><p>{remote.available.release_notes || "Няма допълнителни бележки за релийза."}</p><small>Публикувана: {formatDate(remote.available.published_at)} · {formatBytes(remote.available.size)}</small><div className="updates-actions"><LoadingButton className="react-secondary-button" type="button" loading={busyAction === "update_remote" || updateQueued} disabled={busyAction !== null || updateQueued} onClick={() => void runAction("update_remote")}>{updateQueued ? "Обновяването се изпълнява…" : "Обнови сега"}</LoadingButton></div></div></> : <><CheckCircle2 aria-hidden="true" /><div><h2>Платформата е актуална</h2><p>Няма налична съвместима актуализация за текущия канал.</p></div></>}
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="История на обновяванията" icon={History} storageKey="updates-history" className="updates-section">
        {history.length === 0 ? <p className="react-muted">Все още няма записана история.</p> : <div className="updates-history-list">{history.map((record, index) => <div className="updates-history-row" key={(record.id ?? "record") + "-" + index}><div><strong>{record.type === "platform_rollback" ? "Rollback" : "Обновяване " + (record.from ?? "—") + " → " + (record.to ?? "—")}</strong><small>{formatDate(record.updated_at ?? record.rolled_back_at)}</small></div>{record.type === "platform" && record.id && record.to === version && <LoadingButton type="button" loading={busyAction === "rollback"} disabled={busyAction !== null} onClick={() => setPendingRollback(record)}><RotateCcw aria-hidden="true" />Върни назад</LoadingButton>}</div>)}</div>}
      </CollapsibleSection>
      <CollapsibleSection title="Всички налични релийзи" icon={Archive} storageKey="updates-releases" className="updates-section">
        <div className="updates-releases-list">{releases.length === 0 ? <p className="react-muted">Няма налични релийзи.</p> : releases.map((release) => <div className="updates-release-row" key={release.version}><div className="updates-release-info"><div><strong>Версия {release.version}</strong>{release.current && <span className="updates-release-current">Текуща</span>}{release.downgrade && !release.current && <span className="updates-release-downgrade">Downgrade</span>}</div><small>{formatDate(release.published_at)} · {formatBytes(release.size)}</small>{release.release_notes && <p>{release.release_notes}</p>}{release.blocked_reason && <span className="updates-release-blocked">{release.blocked_reason}</span>}</div>{release.current ? <span className="react-status-badge status-published">Инсталиран</span> : <LoadingButton type="button" className="react-secondary-button" disabled={busyAction !== null || updateQueued || release.installable !== true} loading={busyReleaseVersion === release.version} onClick={() => release.downgrade ? setPendingRelease(release) : void runAction("update_remote", { version: release.version })}>{release.downgrade ? "Инсталирай" : "Обнови"}</LoadingButton>}</div>)}</div>
      </CollapsibleSection>
    </div>}
    <ConfirmDialog open={pendingRollback !== null} title="Връщане към предишна версия" message={pendingRollback ? "Платформата ще бъде върната от версия " + pendingRollback.to + " към " + pendingRollback.from + "." : ""} confirmLabel="Върни назад" danger={true} busy={busyAction === "rollback"} onCancel={() => { if (busyAction === null) setPendingRollback(null) }} onConfirm={() => { if (pendingRollback?.id) { const id = pendingRollback.id; setPendingRollback(null); void runAction("rollback", { id }) } }} />
    <ConfirmDialog open={pendingRelease !== null} title="Инсталиране на по-стара версия" message={pendingRelease ? `Ще инсталирате версия ${pendingRelease.version}. Това е downgrade и ще замени текущата платформа. Продължавате ли?` : ""} confirmLabel="Инсталирай версията" danger={true} busy={busyAction === "update_remote"} onCancel={() => { if (busyAction === null) setPendingRelease(null) }} onConfirm={() => { if (pendingRelease) { const version = pendingRelease.version; setPendingRelease(null); void runAction("update_remote", { version }) } }} />
  </AdminShell>
}
