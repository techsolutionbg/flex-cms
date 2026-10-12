export const SETTINGS_TAB_EVENT = "flex-admin-settings-tab"
const SETTINGS_TAB_KEY = "flex-admin-settings-tab"

export const CORE_SETTINGS_SECTIONS = [
  "general",
  "public",
  "users",
  "media",
  "mail",
  "updates",
  "admin",
  "maintenance",
] as const

export type CoreSettingsSection = (typeof CORE_SETTINGS_SECTIONS)[number]

export function settingsPathForSection(section: string): string {
  const id = section.trim() || "general"
  return `/settings/${encodeURIComponent(id)}`
}

export function settingsSectionFromPath(path: string): string {
  if (path === "/settings") return "general"
  if (!path.startsWith("/settings/")) return "general"
  const segment = path.slice("/settings/".length).split("/")[0] ?? ""
  return segment ? decodeURIComponent(segment) : "general"
}

export function isSettingsWorkspacePath(path: string): boolean {
  return path === "/settings" || /^\/settings\/[^/]+$/.test(path)
}

export function normalizeSettingsWorkspacePath(path: string): string {
  if (path === "/settings") return settingsPathForSection("general")
  if (isSettingsWorkspacePath(path)) return path
  return settingsPathForSection("general")
}

/** Selects a settings tab (for example a plugin tab) when the settings page is shown next or is already open. */
export function openSettingsTab(tab: string): void {
  try {
    window.sessionStorage.setItem(SETTINGS_TAB_KEY, tab)
  } catch {
    // The event below still switches an open settings page.
  }
  window.dispatchEvent(new CustomEvent(SETTINGS_TAB_EVENT, { detail: { tab } }))
}

export function takeRequestedSettingsTab(): string | null {
  try {
    const tab = window.sessionStorage.getItem(SETTINGS_TAB_KEY)
    window.sessionStorage.removeItem(SETTINGS_TAB_KEY)
    return tab
  } catch {
    return null
  }
}
