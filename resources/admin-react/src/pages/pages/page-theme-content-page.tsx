import { t } from "@/lib/admin-i18n"
import { Save } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { useMemo, useRef, useState, type SyntheticEvent } from "react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { usePageHelp } from "@/components/page-help"
import type { PageRecord } from "@/lib/admin-types"
import { ExtensionScope, usePanelSaves } from "@/components/extension-page"
import { ExtensionComponent, useExtensions } from "@/components/extension-runtime"
import { useFormDirty } from "@/lib/use-form-dirty"

const templateLabels: Record<string, string> = {
  default: "Стандартен",
  full_width: "Пълна ширина",
  landing: "Landing page",
}

const templateLayoutHint: Record<string, string> = {
  default: "Допълнително (встъпление)",
  full_width: "Кейс / проект",
  landing: "Hero и акценти",
}

type PageThemeContentFormProps = {
  page: PageRecord
  onBack: () => void
  onEdit: (page: PageRecord) => void
  onSettings: (page: PageRecord) => void
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
}

export function PageThemeContentForm({
  page,
  onBack,
  onEdit,
  onSettings,
  onLogout,
  onNavigate,
  loggingOut,
}: PageThemeContentFormProps) {
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const saves = usePanelSaves()
  const panels = useExtensions("page.theme-content", "screen.section")
  const { isDirty, markClean, refresh } = useFormDirty(formRef, panels.length > 0)
  const panelContext = useMemo(
    () => ({
      type: "page",
      id: page.id,
      page,
      settings: page.settings ?? { template: "default" },
    }),
    [page],
  )
  const extensionScope = useMemo(
    () => ({ context: panelContext, saves }),
    [panelContext, saves],
  )
  const template = page.settings?.template ?? "default"
  const templateLabel = templateLabels[template] ?? template
  const layoutHint = t(templateLayoutHint[template] ?? template)

  usePageHelp(
    useMemo(
      () => ({
        title: "Съдържание от темата",
        content: (
          <>
            <p>

              {t("Fields come from the active theme, usually")} <strong>{t("for selected pages only")}</strong> (
              <code>manifest.json</code> → <code>pages</code>{t(", by slug or ID, and/or globally in settings. The theme can also add CMS template layouts later.")}
            </p>
            <p>
              „{page.title}“
              {page.slug ? (
                <>
                  {" "}
                  (slug: <strong>{page.slug}</strong>)
                </>
              ) : null}
              {page.slug === "home" || template === "landing" ? (
                <>

                  {t(". If the slug matches a page binding in the theme, for example")} <strong>home</strong>{t("), you will see sections such as")} <strong>{layoutHint}</strong>.
                </>
              ) : (
                <>

                  {t(". If the theme has no binding for this page, there are no additional fields here—only the editor content.")}
                </>
              )}
            </p>
            <p>

              {t("Global fields (logo, contact details, footer, and more) are edited under Themes → theme → Theme settings, not on this screen.")}
            </p>
          </>
        ),
      }),
      [page.title, page.slug, template, templateLabel, layoutHint],
    ),
  )

  async function save(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      await saves.run({ id: page.id })
      markClean()
      toast.success("Съдържанието от темата е запазено.")
    } catch (reason) {
      toast.error(
        reason instanceof Error ? reason.message : "Съдържанието не можа да бъде запазено.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      title={t("Theme content")}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Страници"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{t("Theme content")}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[
              { label: "Страници", onClick: onBack },
              { label: page.title, onClick: () => onEdit(page) },
              { label: "Съдържание от темата" },
            ]}
          />
        </div>
        <button type="button" onClick={() => onSettings(page)}>

          {t("Settings for this page")}
        </button>
      </div>
      {panels.length === 0 ? (
        <p role="status">

          {t("No active extension provides theme fields, or the active theme has no declared schema.")}
        </p>
      ) : (
        <ExtensionScope value={extensionScope}>
          <form ref={formRef} className="react-page-form theme-content-page-form" onClickCapture={refresh} onSubmit={save}>
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
              <LoadingButton type="submit" loading={saving} disabled={!isDirty}>
                <Save aria-hidden="true" />

                {t("Save")}
              </LoadingButton>
            </div>
          </form>
        </ExtensionScope>
      )}
    </AdminShell>
  )
}
