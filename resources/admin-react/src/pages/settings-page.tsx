import { useState } from "react"
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
}: {
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
}) {
  const [selected, setSelected] = useState<string>("general")
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
          const index = sections.findIndex((section) => section.id === selected)
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? sections.length - 1
                : (index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) %
                  sections.length
          setSelected(sections[next].id)
          event.currentTarget
            .querySelector<HTMLButtonElement>(`#settings-tab-${sections[next].id}`)
            ?.focus()
        }}
      >
        {sections.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`react-secondary-button settings-tab${selected === id ? " is-active" : ""}`}
            role="tab"
            id={`settings-tab-${id}`}
            aria-selected={selected === id}
            aria-controls={`settings-panel-${id}`}
            tabIndex={selected === id ? 0 : -1}
            onClick={() => setSelected(id)}
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
          hidden={selected !== section.id}
          tabIndex={0}
        >
          {section.id === "general" ? (
            <GeneralSettingsForm />
          ) : (
            <SectionSettingsForm section={section.id} />
          )}
        </div>
      ))}
    </AdminShell>
  )
}
