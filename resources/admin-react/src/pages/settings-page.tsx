import { t } from "@/lib/admin-i18n"
import { useEffect, useRef, useState } from "react"
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
  List,
  X,
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
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const mobileNavigationTrigger = useRef<HTMLButtonElement>(null)
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

  useEffect(() => {
    if (!mobileNavigationOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavigationOpen(false)
        mobileNavigationTrigger.current?.focus()
      }
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [current, mobileNavigationOpen])

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 721px)")
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileNavigationOpen(false)
    }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])

  function selectSection(id: string, closeDrawer = true) {
    if (id !== current) onSectionChange(id)
    if (closeDrawer) {
      setMobileNavigationOpen(false)
      if (mobileNavigationOpen) mobileNavigationTrigger.current?.focus()
    }
  }
  return (
    <AdminShell
      title={t("Settings")}
      activeItem="Настройки"
      onLogout={onLogout}
      onNavigate={onNavigate}
      loggingOut={loggingOut}
    >
      <div className="react-page-heading settings-page-heading">
        <div className="settings-page-heading-copy">
          <div className="settings-page-heading-title-row">
            <h1>{t("Settings")}</h1>
            <button
              ref={mobileNavigationTrigger}
              type="button"
              className="settings-mobile-nav-trigger"
              aria-label={t("Settings sections")}
              aria-expanded={mobileNavigationOpen}
              aria-controls="settings-sections-navigation"
              onClick={() => setMobileNavigationOpen(true)}
            >
              <List aria-hidden="true" />
            </button>
          </div>
          <Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Настройки" }]} />
        </div>
      </div>
      <div
        id="settings-sections-navigation"
        className={`settings-navigation-shell${mobileNavigationOpen ? " is-open" : ""}`}
        role={mobileNavigationOpen ? "dialog" : undefined}
        aria-modal={mobileNavigationOpen || undefined}
        aria-label={mobileNavigationOpen ? t("Settings sections") : undefined}
        data-open={mobileNavigationOpen}
      >
        <button
          type="button"
          className="settings-nav-backdrop"
          aria-label={t("Close")}
          tabIndex={-1}
          onClick={() => {
            setMobileNavigationOpen(false)
            mobileNavigationTrigger.current?.focus()
          }}
        />
        <div className="settings-nav-drawer">
          <div className="settings-nav-header">
            <h2>{t("Settings sections")}</h2>
            <button
              type="button"
              aria-label={t("Close")}
              onClick={() => {
                setMobileNavigationOpen(false)
                mobileNavigationTrigger.current?.focus()
              }}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div
            className="settings-tabs"
            role="tablist"
            aria-label={t("Settings sections")}
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
              selectSection(tabs[next].id, false)
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
                {t(title)}
              </button>
            ))}
          </div>
        </div>
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
