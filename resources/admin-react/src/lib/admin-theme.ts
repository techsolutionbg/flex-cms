export type AdminThemeMode = "system" | "light" | "dark"

// The theme applied last, used for the first paint before the session is restored.
const storageKey = "flex-admin-theme"
// A user's own choice from the profile. It wins over the default from Settings → Administration panel.
const personalPrefix = "flex-admin-theme:user:"

let currentUserId = 0
let siteDefault: AdminThemeMode = "system"

function isTheme(value: unknown): value is AdminThemeMode {
  return value === "system" || value === "light" || value === "dark"
}

/** Identifies the signed-in user, so their personal theme is used on this device. */
export function setAdminThemeUser(userId: number): void {
  currentUserId = userId > 0 ? userId : 0
}

/** The user's own theme from the profile, or null when they follow the panel default. */
export function getPersonalTheme(userId = currentUserId): AdminThemeMode | null {
  if (userId <= 0) return null
  try {
    const value = window.localStorage.getItem(personalPrefix + userId)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

/** Saves (or with null clears) the user's own theme and applies the result. */
export function savePersonalTheme(theme: AdminThemeMode | null, userId = currentUserId): void {
  if (userId > 0) {
    try {
      if (theme === null) window.localStorage.removeItem(personalPrefix + userId)
      else window.localStorage.setItem(personalPrefix + userId, theme)
    } catch {
      // The theme still applies for the current session.
    }
  }
  setAdminTheme(theme ?? siteDefault)
}

/** The panel default from Settings → Administration panel. */
export function getSiteDefaultTheme(): AdminThemeMode {
  return siteDefault
}

/** The theme that applies to the signed-in user: their own choice, otherwise the panel default. */
export function effectiveAdminTheme(): AdminThemeMode {
  return getPersonalTheme() ?? siteDefault
}

export function applyAdminSettings(values: Record<string, string>): void {
  if (isTheme(values.theme)) siteDefault = values.theme
  setAdminTheme(effectiveAdminTheme())
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

/** The theme applied last on this device. */
export function getAdminTheme(): AdminThemeMode {
  try {
    const value = window.localStorage.getItem(storageKey)
    if (isTheme(value)) return value
  } catch {
    // Use the system preference when local storage is unavailable.
  }
  return "system"
}

export type AdminColorScheme = "light" | "dark"

export function readAdminColorScheme(): AdminColorScheme {
  if (typeof document === "undefined") return "light"
  return document.documentElement.dataset.adminTheme === "dark" ? "dark" : "light"
}

/** Notifies when the resolved light/dark appearance of the panel changes. */
export function subscribeAdminColorScheme(onChange: () => void): () => void {
  const root = document.documentElement
  const media = window.matchMedia?.("(prefers-color-scheme: dark)")
  const observer = new MutationObserver(onChange)
  observer.observe(root, { attributes: true, attributeFilter: ["data-admin-theme"] })
  media?.addEventListener("change", onChange)
  return () => {
    observer.disconnect()
    media?.removeEventListener("change", onChange)
  }
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
