import { settingsPathForSection } from "./settings-tabs"

export type PanelSearchTarget = {
  id: string
  label: string
  group: string
  path: string
  keywords?: string
  settingsTab?: string
}

export const CORE_PANEL_SEARCH_TARGETS: PanelSearchTarget[] = [
  { id: "dashboard", label: "Табло", group: "Основни", path: "/", keywords: "dashboard home начало" },
  { id: "pages", label: "Страници", group: "Съдържание", path: "/pages", keywords: "pages content" },
  { id: "media", label: "Медийна библиотека", group: "Съдържание", path: "/media", keywords: "media images files снимки" },
  { id: "menus", label: "Менюта", group: "Съдържание", path: "/menus", keywords: "navigation menu" },
  { id: "themes", label: "Теми", group: "Външен вид", path: "/themes", keywords: "theme appearance" },
  { id: "theme-store", label: "Каталог с теми", group: "Външен вид", path: "/theme-store", keywords: "store catalog" },
  { id: "users", label: "Потребители", group: "Управление", path: "/users", keywords: "accounts admin" },
  { id: "plugins", label: "Разширения", group: "Управление", path: "/plugins", keywords: "plugins extensions" },
  { id: "plugin-catalog", label: "Каталог с разширения", group: "Управление", path: "/plugins/catalog", keywords: "store catalog install" },
  { id: "updates", label: "Обновявания", group: "Система", path: "/updates", keywords: "update upgrade version" },
  {
    id: "settings",
    label: "Настройки",
    group: "Система",
    path: settingsPathForSection("general"),
    keywords: "settings configuration",
  },
  { id: "profile", label: "Профил", group: "Акаунт", path: "/profile", keywords: "account password" },
  {
    id: "settings-general",
    label: "Общи настройки",
    group: "Настройки",
    path: settingsPathForSection("general"),
    keywords: "site language locale",
  },
  {
    id: "settings-public",
    label: "Публична част",
    group: "Настройки",
    path: settingsPathForSection("public"),
    keywords: "frontend public",
  },
  {
    id: "settings-users",
    label: "Потребители и достъп",
    group: "Настройки",
    path: settingsPathForSection("users"),
    keywords: "registration access",
  },
  {
    id: "settings-media",
    label: "Медийна библиотека (настройки)",
    group: "Настройки",
    path: settingsPathForSection("media"),
    keywords: "upload thumbnails",
  },
  {
    id: "settings-mail",
    label: "Имейли",
    group: "Настройки",
    path: settingsPathForSection("mail"),
    keywords: "smtp email mail",
  },
  {
    id: "settings-updates",
    label: "Обновявания (настройки)",
    group: "Настройки",
    path: settingsPathForSection("updates"),
    keywords: "catalog channel",
  },
  {
    id: "settings-admin",
    label: "Административен панел",
    group: "Настройки",
    path: settingsPathForSection("admin"),
    keywords: "theme dark ui",
  },
  {
    id: "settings-maintenance",
    label: "Поддръжка и диагностика",
    group: "Настройки",
    path: settingsPathForSection("maintenance"),
    keywords: "errors log diagnostics operation",
  },
]

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("bg")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

export function filterPanelSearchTargets(
  targets: PanelSearchTarget[],
  query: string,
  limit = 12,
): PanelSearchTarget[] {
  const needle = normalize(query.trim())
  if (needle === "") return targets.slice(0, limit)
  const scored = targets
    .map((target) => {
      const haystack = normalize(`${target.label} ${target.group} ${target.keywords ?? ""} ${target.path}`)
      if (haystack.includes(needle)) return { target, score: haystack.indexOf(needle) }
      const parts = needle.split(/\s+/).filter(Boolean)
      if (parts.every((part) => haystack.includes(part))) return { target, score: 100 }
      return null
    })
    .filter((item): item is { target: PanelSearchTarget; score: number } => item !== null)
    .sort((left, right) => left.score - right.score || left.target.label.localeCompare(right.target.label, "bg"))
  return scored.slice(0, limit).map((item) => item.target)
}
