import { Save } from "lucide-react"
import { useEffect, useMemo, useState, type SyntheticEvent } from "react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { LoadingButton } from "@/components/loading-button"
import { usePageHelp } from "@/components/page-help"
import { ExtensionScope, usePanelSaves } from "@/components/extension-page"
import { ExtensionComponent, useExtensions } from "@/components/extension-runtime"

type ThemeSummary = { id: string; name: string | null; active: boolean }

/**
 * Theme settings (`/themes/{id}/settings`): hosts the `theme.settings` panels. The fields are not
 * written here — the panel builds sections and fields from the theme's JSON schema.
 */
export function ThemeSettingsPage({
  id,
  onLogout,
  onNavigate,
  loggingOut,
  onBack,
  onDetails,
}: {
  id: string
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
  onBack: () => void
  onDetails: () => void
}) {
  const [theme, setTheme] = useState<ThemeSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saves = usePanelSaves()
  const panels = useExtensions("theme.settings", "screen.section")
  const panelContext = useMemo(() => ({ type: "theme", id, theme }), [id, theme])
  const extensionScope = useMemo(() => ({ context: panelContext, saves }), [panelContext, saves])
  const name = theme?.name ?? id

  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetch(`/api/admin/themes/${encodeURIComponent(id)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error?.message ?? "Темата не можа да бъде заредена.")
        if (!controller.signal.aborted)
          setTheme({ id: body.theme.id, name: body.theme.name, active: Boolean(body.theme.active) })
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Грешка при зареждане.")
      })
    return () => controller.abort()
  }, [id])

  usePageHelp(
    useMemo(
      () => ({
        title: "Настройки на темата",
        content: (
          <>
            <p>
              Глобалните настройки на темата — лого, header, контакти, Footer и др. Важат за целия
              сайт.
            </p>
            <p>
              Секциите и полетата идват от JSON файла на темата (<code>content_schema</code> в{" "}
              <code>theme.json</code> → <code>global</code>). Нова секция или поле се добавя само
              в JSON файла.
            </p>
          </>
        ),
      }),
      [],
    ),
  )

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await saves.run({ id })
      toast.success("Настройките на темата са запазени.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Настройките не можаха да бъдат запазени.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      title={`Настройки: ${name}`}
      activeItem="Теми"
      onLogout={onLogout}
      onNavigate={onNavigate}
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>Настройки на темата</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[
              { label: "Теми", onClick: onBack },
              { label: name, onClick: onDetails },
              { label: "Настройки" },
            ]}
          />
        </div>
        <LoadingButton onClick={onDetails}>Към детайлите</LoadingButton>
      </div>
      {error && (
        <p className="react-error-text" role="alert">
          {error}
        </p>
      )}
      {!theme && !error && <p role="status">Зареждане…</p>}
      {theme && !theme.active && (
        <p role="status">Настройките са достъпни, когато темата е активна. Активирайте я от детайлите.</p>
      )}
      {theme?.active && panels.length === 0 && (
        <p role="status">
          Няма разширение за настройки на темата. Активирайте плъгина „Flex Theme Content“ и
          декларирайте <code>content_schema</code> в <code>theme.json</code>.
        </p>
      )}
      {theme?.active && panels.length > 0 && (
        <ExtensionScope value={extensionScope}>
          <form className="react-page-form theme-content-page-form" onSubmit={save}>
            <div className="theme-content-workspace">
              {panels.map((panel) => (
                <ExtensionComponent
                  key={panel.id}
                  descriptor={panel}
                  context={panelContext}
                  saves={saves}
                />
              ))}
            </div>
            <div className="react-form-actions">
              <LoadingButton type="submit" loading={saving}>
                <Save aria-hidden="true" />
                Запази
              </LoadingButton>
            </div>
          </form>
        </ExtensionScope>
      )}
    </AdminShell>
  )
}
