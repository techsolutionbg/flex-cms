import { t } from "@/lib/admin-i18n"
import { useEffect, useState } from "react"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { ThemeSourceEditor } from "@/components/theme-source-editor"
import type { ThemeRecord } from "@/lib/admin-types"
import { toast } from "sonner"

export function ThemeEditorPage({
  onLogout,
  onNavigate,
  loggingOut,
}: {
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
}) {
  const [themes, setThemes] = useState<ThemeRecord[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState("")
  const [loadingThemes, setLoadingThemes] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/admin/themes", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          themes?: ThemeRecord[]
          error?: { message?: string }
        }
        if (!response.ok)
          throw new Error(body.error?.message ?? "Темите не можаха да бъдат заредени.")
        const installedThemes = body.themes ?? []
        setThemes(installedThemes)
        setSelectedThemeId(installedThemes.find((theme) => theme.active)?.id ?? "")
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          toast.error(reason instanceof Error ? reason.message : "Темите не можаха да бъдат заредени.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingThemes(false)
      })

    return () => controller.abort()
  }, [])

  const selectedTheme = themes.find((theme) => theme.id === selectedThemeId)
  const [hasUnsavedThemeChanges, setHasUnsavedThemeChanges] = useState(false)

  function selectTheme(themeId: string) {
    if (themeId === selectedThemeId) return
    if (hasUnsavedThemeChanges && !window.confirm(t("You have unsaved theme file changes. Discard them?"))) return
    setSelectedThemeId(themeId)
    setHasUnsavedThemeChanges(false)
  }

  return (
    <AdminShell
      title={t("Theme editor")}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Теми"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{t("Theme editor")}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[
              { label: "Themes", onClick: () => onNavigate("Теми") },
              { label: t("Theme editor") },
            ]}
          />
        </div>
      </div>
      <CollapsibleSection title="Themes" storageKey="theme-editor-empty-section">
        <div className="theme-editor-settings">
          <label className="react-form-field">
            <span>{t("Theme")}</span>
            <DropdownMenu
              ariaLabel={t("Choose a theme")}
              disabled={loadingThemes || themes.length === 0}
              triggerClassName="react-form-select"
              trigger={
                <>
                  <span>
                    {loadingThemes
                      ? t("Loading themes…")
                      : selectedTheme?.name ??
                        (themes.length === 0 ? t("No installed themes") : t("Select a theme"))}
                  </span>
                  <DropdownChevron />
                </>
              }
            >
              {themes.map((theme) => (
                <DropdownOption
                  key={theme.id}
                  selected={selectedThemeId === theme.id}
                  onClick={() => selectTheme(theme.id)}
                >
                  {theme.name}
                </DropdownOption>
              ))}
            </DropdownMenu>
          </label>
          {themes.length > 0 && selectedTheme && (
            <ThemeSourceEditor
              key={selectedTheme.id}
              themeId={selectedTheme.id}
              onUnsavedChangesChange={setHasUnsavedThemeChanges}
            />
          )}
        </div>
      </CollapsibleSection>
    </AdminShell>
  )
}
