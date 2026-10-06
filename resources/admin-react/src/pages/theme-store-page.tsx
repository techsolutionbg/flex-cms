import { useEffect, useState } from "react"
import { ArrowDownToLine, PackageOpen, Power, Upload } from "lucide-react"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import type { ThemeCatalogRecord } from "@/lib/admin-types"
import { toast } from "sonner"

type ThemeStorePageProps = {
  onLogout: () => void
  onNavigate: (label: string) => void
  onBack: () => void
  onDetails?: (id: string) => void
  loggingOut: boolean
}
type StoreAction = "install" | "activate" | "deactivate"

export function ThemeStorePage({
  onLogout,
  onNavigate,
  onBack,
  onDetails,
  loggingOut,
}: ThemeStorePageProps) {
  const [catalog, setCatalog] = useState<ThemeCatalogRecord[]>([])
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<{ id: string; action: StoreAction } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/themes/catalog", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          catalog?: ThemeCatalogRecord[]
          error?: { message?: string }
        }
        if (!response.ok)
          throw new Error(body.error?.message ?? "Каталогът не можа да бъде зареден.")
        if (!cancelled) {
          const themes = body.catalog ?? []
          setCatalog(themes)
          setActiveThemeId(themes.find((item) => item.active)?.id ?? null)
        }
      })
      .catch((reason) => {
        if (!cancelled)
          toast.error(
            reason instanceof Error ? reason.message : "Каталогът не можа да бъде зареден.",
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function runAction(theme: ThemeCatalogRecord, action: StoreAction) {
    if (busyAction !== null) return
    setBusyAction({ id: theme.id, action })
    try {
      const token = await getCsrfToken()
      const remoteAction =
        action === "install" ? (theme.installed ? "update_remote" : "install_remote") : action
      const response = await fetch("/api/themes/action", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({ id: theme.id, action: remoteAction }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        error?: { message?: string }
        themes?: Array<{ id: string; version: string; active: boolean }>
      }
      if (!response.ok)
        throw new Error(body.error?.message ?? "Действието не можа да бъде изпълнено.")
      const updated = body.themes?.find((item) => item.id === theme.id)
      if (!updated)
        throw new Error(
          "Сървърът не потвърди, че темата присъства сред инсталираните файлове. Презаредете каталога и проверете папката за теми.",
        )
      if (action === "activate" && !updated.active)
        throw new Error("Сървърът не потвърди активирането на темата.")
      if (action === "deactivate" && updated.active)
        throw new Error("Сървърът не потвърди деактивирането на темата.")
      if (!body.themes) throw new Error("Сървърът не върна актуалния списък с инсталирани теми.")
      window.dispatchEvent?.(new Event("flex-admin-theme-changed"))
      const installedThemes = new Map(body.themes.map((item) => [item.id, item]))
      setActiveThemeId(
        action === "activate"
          ? theme.id
          : action === "deactivate"
            ? null
            : (body.themes.find((item) => item.active)?.id ?? activeThemeId),
      )
      setCatalog((current) =>
        current.map((item) => {
          const installedTheme = installedThemes.get(item.id)
          return {
            ...item,
            installed: installedTheme !== undefined,
            active: installedTheme?.active ?? false,
            installed_version: installedTheme?.version ?? null,
            update_available:
              installedTheme !== undefined && item.id !== theme.id ? item.update_available : false,
          }
        }),
      )
      toast.success(
        remoteAction === "install_remote"
          ? "Темата е инсталирана."
          : remoteAction === "update_remote"
            ? "Темата е обновена."
            : remoteAction === "deactivate"
              ? "Темата е деактивирана."
              : "Темата е активирана.",
      )
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Действието не можа да бъде изпълнено.",
      )
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <AdminShell
      title="Каталог с теми"
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Теми"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>Каталог с теми</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[{ label: "Теми", onClick: onBack }, { label: "Каталог" }]}
          />
        </div>
        <button type="button" onClick={onBack}>
          Назад към темите
        </button>
      </div>
      {loading ? (
        <div className="react-catalog-empty">Зареждане на каталога…</div>
      ) : catalog.length === 0 ? (
        <div className="react-catalog-empty">
          <PackageOpen aria-hidden="true" />
          <strong>Няма публикувани теми.</strong>
          <span>Каталогът временно не съдържа достъпни теми.</span>
        </div>
      ) : (
        <div className="theme-store-grid">
          {catalog.map((theme) => {
            const busy = busyAction?.id === theme.id
            const installed = theme.installed
            const active = theme.id === activeThemeId
            return (
              <article className="theme-store-card" key={theme.id}>
                <div className="theme-store-preview">
                  {theme.screenshot_url ? (
                    <img src={theme.screenshot_url} alt={`Преглед на ${theme.name}`} />
                  ) : (
                    <img src="/theme-placeholder.png" alt="" />
                  )}
                </div>
                <div className="theme-store-body">
                  <div className="theme-store-title">
                    <div>
                      <h2>{theme.name}</h2>
                      <span>{theme.id}</span>
                    </div>
                    <span
                      className={`react-status-badge status-${active ? "active" : installed ? "installed" : "inactive"}`}
                    >
                      <span className="status-dot" />
                      {active ? "Активна" : installed ? "Инсталирана" : "Неинсталирана"}
                    </span>
                  </div>
                  <p>{theme.description || "Няма описание за тази тема."}</p>
                  <div className="theme-store-meta">
                    <span>
                      Версия <strong>{theme.version}</strong>
                    </span>
                    {theme.author && (
                      <span>
                        Автор <strong>{theme.author}</strong>
                      </span>
                    )}
                  </div>
                  {theme.tags && theme.tags.length > 0 && (
                    <div className="theme-card-tags">
                      {theme.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                  {theme.update_available && (
                    <div className="theme-card-update">Налична е нова версия</div>
                  )}
                  {theme.release_notes && (
                    <div className="theme-card-notes">
                      <strong>Какво ново</strong>
                      <span>{theme.release_notes}</span>
                    </div>
                  )}
                </div>
                <div className="theme-store-actions">
                  <LoadingButton onClick={() => onDetails?.(theme.id)}>Детайли</LoadingButton>
                  {installed && (
                    <LoadingButton
                      type="button"
                      loading={busy && busyAction?.action === (active ? "deactivate" : "activate")}
                      disabled={busyAction !== null}
                      onClick={() => void runAction(theme, active ? "deactivate" : "activate")}
                    >
                      <Power aria-hidden="true" />
                      {active ? "Деактивирай" : "Активирай"}
                    </LoadingButton>
                  )}
                  <LoadingButton
                    type="button"
                    loading={busy && busyAction?.action === "install"}
                    disabled={busyAction !== null}
                    onClick={() => void runAction(theme, "install")}
                  >
                    {installed ? (
                      <>
                        <Upload aria-hidden="true" />
                        {theme.update_available ? "Обнови" : "Преинсталирай"}
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine aria-hidden="true" />
                        Инсталирай
                      </>
                    )}
                  </LoadingButton>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </AdminShell>
  )
}
