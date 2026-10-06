export type AdminThemeMode = "system" | "light" | "dark"

const storageKey = "flex-admin-theme"

export function applyAdminSettings(values: Record<string, string>): void {
  if (["system", "light", "dark"].includes(values.theme))
    setAdminTheme(values.theme as AdminThemeMode)
  try {
    window.localStorage.setItem("flex-admin-remember-tabs", values.remember_tabs)
  } catch {
    /* Storage is optional. */
  }
}

export async function loadAdminSettings(): Promise<void> {
  const response = await fetch("/api/admin/settings/admin", {
    credentials: "include",
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error("Предпочитанията на панела не могат да бъдат заредени.")
  const body = await response.json()
  applyAdminSettings(body.settings)
}

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
