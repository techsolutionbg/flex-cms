import { Save } from "lucide-react"
import { LoadingButton } from "@/components/loading-button"
import { useMemo, useState, type SyntheticEvent } from "react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { usePageHelp } from "@/components/page-help"
import type { PageRecord } from "@/lib/admin-types"
import { ExtensionScope, usePanelSaves } from "@/components/extension-page"
import { ExtensionComponent, useExtensions } from "@/components/extension-runtime"

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
  const saves = usePanelSaves()
  const panels = useExtensions("page.theme-content", "screen.section")
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
  const layoutHint = templateLayoutHint[template] ?? template

  usePageHelp(
    useMemo(
      () => ({
        title: "Съдържание от темата",
        content: (
          <>
            <p>
              Полетата идват от активната тема — обикновено <strong>само за избрани страници</strong> (
              <code>manifest.json</code> → <code>pages</code>, по slug или id) и/или глобално в
              настройките. Темата може по-късно да добави и layout-и по CMS шаблон.
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
                  . Ако slug съвпада с page binding в темата (напр. <strong>home</strong>), виждате
                  секции като <strong>{layoutHint}</strong>.
                </>
              ) : (
                <>
                  . Ако темата няма binding за тази страница, тук няма допълнителни полета — само
                  съдържанието от редактора.
                </>
              )}
            </p>
            <p>
              Глобални полета (лого, контакт, Footer) се редактират от „Теми“ → темата → „Настройки на
              темата“, не от
              този екран.
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
      title="Съдържание от темата"
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Страници"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>Съдържание от темата</h1>
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
          Настройки на страницата
        </button>
      </div>
      {panels.length === 0 ? (
        <p role="status">
          Няма активно разширение за полета на темата или активната тема няма декларирана схема.
        </p>
      ) : (
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
