export const SETTINGS_TAB_EVENT = "flex-admin-settings-tab"
const SETTINGS_TAB_KEY = "flex-admin-settings-tab"

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
