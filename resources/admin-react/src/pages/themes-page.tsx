import { useEffect, useState } from "react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { AdminShell } from "@/components/admin-shell"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import type { ThemeRecord } from "@/lib/admin-types"
import { adminUrl } from "@/lib/admin-routes"
import { toast } from "sonner"
import { Power, Trash2, Upload } from "lucide-react"

type ThemeAction = "activate" | "deactivate" | "update_remote" | "delete"
type ThemesPageProps = {
  onLogout: () => void
  onNavigate: (label: string) => void
  onCatalog?: () => void
  onDetails?: (id: string) => void
  loggingOut: boolean
}

export function ThemesPage({
  onLogout,
  onNavigate,
  onCatalog,
  onDetails,
  loggingOut,
}: ThemesPageProps) {
  const [themes, setThemes] = useState<ThemeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<ThemeRecord | null>(null)

  async function loadThemes() {
    try {
      const response = await fetch("/api/admin/themes", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      const body = (await response.json().catch(() => ({}))) as {
        themes?: ThemeRecord[]
        error?: { message?: string }
      }
      if (!response.ok)
        throw new Error(body.error?.message ?? "Темите не можаха да бъдат заредени.")
      setThemes(body.themes ?? [])
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Темите не можаха да бъдат заредени.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadThemes()
  }, [])

  async function runAction(theme: ThemeRecord, action: ThemeAction) {
    if (busyId !== null) return
    setBusyId(theme.id)
    let themesAfterDeactivation: ThemeRecord[] | null = null
    try {
      const token = await getCsrfToken()
      const sendAction = async (requestedAction: ThemeAction) => {
        const response = await fetch("/api/themes/action", {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
          },
          body: JSON.stringify({ id: theme.id, action: requestedAction }),
        })
        const body = (await response.json().catch(() => ({}))) as {
          themes?: ThemeRecord[]
          error?: { message?: string }
        }
        if (!response.ok)
          throw new Error(body.error?.message ?? "Действието не можа да бъде изпълнено.")
        return body
      }

      if (action === "delete" && theme.active) {
        const deactivated = await sendAction("deactivate")
        const deactivatedTheme = deactivated.themes?.find((item) => item.id === theme.id)
        if (!deactivatedTheme || deactivatedTheme.active)
          throw new Error("Темата не беше деактивирана и не е изтрита.")
        themesAfterDeactivation = deactivated.themes ?? null
      }

      const body = await sendAction(action)
      window.dispatchEvent?.(new Event("flex-admin-theme-changed"))
      if (body.themes) setThemes(body.themes)
      else await loadThemes()
      toast.success(
        action === "activate"
          ? "Темата е активирана."
          : action === "deactivate"
            ? "Темата е деактивирана."
            : action === "update_remote"
              ? "Темата е обновена."
              : "Темата е изтрита.",
      )
    } catch (reason) {
      if (themesAfterDeactivation) {
        window.dispatchEvent?.(new Event("flex-admin-theme-changed"))
        setThemes(themesAfterDeactivation)
        const message = reason instanceof Error ? reason.message : "неизвестна грешка"
        toast.error(`Темата е деактивирана, но не беше изтрита: ${message}`)
      } else {
        toast.error(
          reason instanceof Error ? reason.message : "Действието не можа да бъде изпълнено.",
        )
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AdminShell
      title="Теми"
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Теми"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>Теми ({themes.length})</h1>
          <Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Теми" }]} />
        </div>
        <button
          type="button"
          onClick={() =>
            onCatalog ? onCatalog() : window.location.assign(adminUrl("/theme-store"))
          }
        >
          Каталог с теми
        </button>
      </div>
      <section className="themes-section">
        {loading ? (
          <p>Зареждане…</p>
        ) : themes.length === 0 ? (
          <p>Няма открити теми.</p>
        ) : (
          <div className="theme-grid">
            {themes.map((theme) => {
              const busy = busyId === theme.id

              return (
                <article className="theme-card" key={theme.id}>
                  <div className="theme-card-preview">
                    <img
                      src={theme.screenshot_url || "/theme-placeholder.png"}
                      alt={`Преглед на ${theme.name}`}
                      onError={(event) => {
                        if (event.currentTarget.src.endsWith("/theme-placeholder.png")) return
                        event.currentTarget.src = "/theme-placeholder.png"
                      }}
                    />
                    {theme.active && <span className="theme-card-active">Активна тема</span>}
                  </div>
                  <div className="theme-card-body">
                    <div className="theme-card-title">
                      <div>
                        <h3>{theme.name}</h3>
                        <small>{theme.id}</small>
                      </div>
                      <span
                        className={`react-status-badge status-${theme.active ? "active" : "inactive"}`}
                      >
                        <span className="status-dot" />
                        {theme.active ? "Активна" : "Неактивна"}
                      </span>
                    </div>
                    <p>{theme.description || "Без описание."}</p>
                    <div className="theme-card-meta">
                      <span>
                        Версия <strong>{theme.version}</strong>
                      </span>
                      <span>
                        Автор <strong>{theme.author}</strong>
                      </span>
                    </div>
                    {theme.tags && theme.tags.length > 0 && (
                      <div className="theme-card-tags">
                        {theme.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                    {theme.update_available && (
                      <div className="theme-card-update">
                        Налична версия {theme.available_version}
                      </div>
                    )}
                    {theme.release_notes && (
                      <div className="theme-card-notes">
                        <strong>Какво ново</strong>
                        <span>{theme.release_notes}</span>
                      </div>
                    )}
                    {theme.error && <small className="react-error-text">{theme.error}</small>}
                  </div>
                  <div className="theme-card-actions">
                    <LoadingButton onClick={() => onDetails?.(theme.id)}>Детайли</LoadingButton>
                    {theme.valid && (
                      <LoadingButton
                        type="button"
                        loading={busy}
                        disabled={busy}
                        onClick={() =>
                          void runAction(theme, theme.active ? "deactivate" : "activate")
                        }
                      >
                        <Power aria-hidden="true" />
                        {theme.active ? "Деактивирай" : "Активирай"}
                      </LoadingButton>
                    )}
                    {theme.update_available && (
                      <LoadingButton
                        type="button"
                        loading={busy}
                        disabled={busy}
                        onClick={() => void runAction(theme, "update_remote")}
                      >
                        <Upload aria-hidden="true" />
                        Обнови
                      </LoadingButton>
                    )}
                    <LoadingButton
                      type="button"
                      loading={busy}
                      disabled={busy}
                      onClick={() => setPendingRemoval(theme)}
                    >
                      <Trash2 aria-hidden="true" />
                      Изтрий
                    </LoadingButton>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Изтриване на тема"
        message={
          pendingRemoval
            ? `Темата „${pendingRemoval.name}“ ще бъде изтрита окончателно.${pendingRemoval.active ? " Първо ще бъде деактивирана." : ""}`
            : ""
        }
        confirmLabel="Изтрий"
        danger={true}
        busy={pendingRemoval !== null && busyId === pendingRemoval.id}
        onCancel={() => {
          if (busyId === null) setPendingRemoval(null)
        }}
        onConfirm={() => {
          if (pendingRemoval) {
            const theme = pendingRemoval
            setPendingRemoval(null)
            void runAction(theme, "delete")
          }
        }}
      />
    </AdminShell>
  )
}
