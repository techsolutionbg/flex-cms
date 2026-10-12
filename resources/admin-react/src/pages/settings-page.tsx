import { useEffect } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Settings,
  Globe,
  UsersRound,
  Images,
  Mail,
  RefreshCw,
  PanelsTopLeft,
  Wrench,
} from "lucide-react"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { GeneralSettingsForm } from "./general-settings-form"
import { SectionSettingsForm } from "./section-settings-form"
import { ExtensionPanel, panelIcon, useExtensions } from "@/components/extension-page"
import { SETTINGS_TAB_EVENT, takeRequestedSettingsTab } from "@/lib/settings-tabs"

const sections = [
  {
    id: "general",
    title: "Общи",
    icon: Settings,
    description: "Основна информация, език и регионални предпочитания на платформата.",
  },
  {
    id: "public",
    title: "Публична част",
    icon: Globe,
    description: "Оформление и поведение на публичната част на сайта.",
  },
  {
    id: "users",
    title: "Потребители и достъп",
    icon: UsersRound,
    description: "Правила за регистрация, достъп и потребителски сесии.",
  },
  {
    id: "media",
    title: "Медийна библиотека",
    icon: Images,
    description: "Управление на качването и обработката на медийни файлове.",
  },
  {
    id: "mail",
    title: "Имейли",
    icon: Mail,
    description: "Настройки за имейлите, изпращани от платформата.",
  },
  {
    id: "updates",
    title: "Обновявания",
    icon: RefreshCw,
    description: "Предпочитания за проверка и управление на обновяванията.",
  },
  {
    id: "admin",
    title: "Административен панел",
    icon: PanelsTopLeft,
    description: "Общи предпочитания за административния интерфейс.",
  },
  {
    id: "maintenance",
    title: "Поддръжка и диагностика",
    icon: Wrench,
    description: "Инструменти за поддръжка и информация за състоянието на платформата.",
  },
] as const

export function SettingsPage({
  onLogout,
  onNavigate,
  loggingOut,
  section,
  onSectionChange,
}: {
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
  section: string
  onSectionChange: (sectionId: string) => void
}) {
  // Active plugins add their global settings as extra tabs (location settings.tab).
  const extensionTabs = useExtensions("settings", "screen.tab")
  const tabs: { id: string; title: string; icon: LucideIcon }[] = [
    ...sections.map(({ id, title, icon }) => ({ id, title, icon })),
    ...extensionTabs.map((panel) => ({
      id: panel.id,
      title: panel.label,
      icon: panelIcon(panel.icon),
    })),
  ]
  useEffect(() => {
    const requested = takeRequestedSettingsTab()
    if (requested) onSectionChange(requested)
  }, [onSectionChange])
  useEffect(() => {
    const open = (event: Event) => {
      const tab = (event as CustomEvent<{ tab?: string }>).detail?.tab
      if (typeof tab === "string") onSectionChange(tab)
    }
    window.addEventListener(SETTINGS_TAB_EVENT, open)
    return () => window.removeEventListener(SETTINGS_TAB_EVENT, open)
  }, [onSectionChange])
  const current = tabs.some((tab) => tab.id === section) ? section : "general"

  function selectSection(id: string) {
    if (id === current) return
    onSectionChange(id)
  }
  return (
    <AdminShell
      title="Настройки"
      activeItem="Настройки"
      onLogout={onLogout}
      onNavigate={onNavigate}
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>Настройки</h1>
          <Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Настройки" }]} />
        </div>
      </div>
      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Раздели на настройките"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
          event.preventDefault()
          const index = tabs.findIndex((tab) => tab.id === current)
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length
          selectSection(tabs[next].id)
          event.currentTarget
            .querySelector<HTMLButtonElement>(`#settings-tab-${tabs[next].id}`)
            ?.focus()
        }}
      >
        {tabs.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`react-secondary-button settings-tab${current === id ? " is-active" : ""}`}
            role="tab"
            id={`settings-tab-${id}`}
            aria-selected={current === id}
            aria-controls={`settings-panel-${id}`}
            tabIndex={current === id ? 0 : -1}
            onClick={() => selectSection(id)}
          >
            <Icon aria-hidden="true" />
            {title}
          </button>
        ))}
      </div>
      {sections.map((section) => (
        <div
          key={section.id}
          role="tabpanel"
          className="settings-panel"
          id={`settings-panel-${section.id}`}
          aria-labelledby={`settings-tab-${section.id}`}
          hidden={current !== section.id}
          tabIndex={0}
        >
          {section.id === "general" ? (
            <GeneralSettingsForm />
          ) : (
            <SectionSettingsForm section={section.id} />
          )}
        </div>
      ))}
      {extensionTabs.map((panel) => (
        <div
          key={panel.id}
          role="tabpanel"
          className="settings-panel"
          id={`settings-panel-${panel.id}`}
          aria-labelledby={`settings-tab-${panel.id}`}
          hidden={current !== panel.id}
          tabIndex={0}
        >
          <ExtensionPanel descriptor={panel} />
        </div>
      ))}
    </AdminShell>
  )
}
