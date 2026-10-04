export type AdminThemeMode = "system" | "light" | "dark"

const storageKey = "flex-admin-theme"

export function getAdminTheme(): AdminThemeMode {
  try {
    const value = window.localStorage.getItem(storageKey)
    if (value === "light" || value === "dark") return value
  } catch {
    // Use the system preference when local storage is unavailable.
  }
  return "system"
}

export function setAdminTheme(theme: AdminThemeMode): void {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  document.documentElement.dataset.adminThemeMode = theme
  document.documentElement.dataset.adminTheme =
    theme === "system" ? (prefersDark ? "dark" : "light") : theme
  try {
    window.localStorage.setItem(storageKey, theme)
  } catch {
    // The theme still applies for the current session.
  }
}
