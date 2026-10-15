import { isSettingsWorkspacePath, settingsPathForSection } from "./settings-tabs"

const simplePaths = new Set([
  "/",
  "/pages",
  "/media",
  "/menus",
  "/menus/create",
  "/users",
  "/profile",
  "/themes",
  "/theme-editor",
  "/theme-store",
  "/plugins",
  "/plugins/catalog",
  "/updates",
  "/pages/create",
  "/users/create",
])

export function isWorkspacePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 240 &&
    (simplePaths.has(value) ||
      isSettingsWorkspacePath(value) ||
      /^\/pages\/\d+\/(edit|settings|theme-content)$/.test(value) ||
      /^\/media\/\d+\/edit$/.test(value) ||
      /^\/extension-pages\/[a-z][a-z0-9_-]*(?:\/(?:create|[a-z0-9][a-z0-9_-]*\/edit|inbox(?:\/submissions\/[0-9]{14}-[a-f0-9]{16})?))?$/.test(
        value,
      ) ||
      /^\/themes\/[a-z0-9][a-z0-9._-]*(?:\/settings)?$/.test(value) ||
      /^\/users\/\d+\/edit$/.test(value) ||
      /^\/menus\/\d+\/edit$/.test(value) ||
      /^\/menus\/\d+\/structure$/.test(value) ||
      /^\/plugins\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/.test(value) ||
      // Keep previously saved workspace tabs with encoded namespaced IDs restorable.
      /^\/plugins\/[a-zA-Z0-9._-]+(?:%2[fF][a-zA-Z0-9._-]+)?$/.test(value) ||
      /^\/theme-resources\/[a-z][a-z0-9_-]*(?:\/(?:create|\d+\/edit))?$/.test(value))
  )
}

export function readWorkspace(key: string): { paths: string[]; active: string | null } {
  try {
    if (window.localStorage.getItem("flex-admin-remember-tabs") === "0")
      return { paths: [], active: null }
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null")
    if (saved?.version !== 1 || !Array.isArray(saved.paths)) return { paths: [], active: null }
    const normalizePath = (value: string) => {
      if (value === "/media/upload") return "/media"
      if (value === "/settings") return settingsPathForSection("general")
      const legacyPluginPath = value.match(/^\/plugins\/([^/]+)%2[fF]([^/]+)$/)
      if (legacyPluginPath) return `/plugins/${legacyPluginPath[1]}/${legacyPluginPath[2]}`
      return value
    }
    const paths = [
      ...new Set<string>(
        saved.paths
          .filter((value: unknown): value is string => typeof value === "string")
          .map(normalizePath)
          .filter(isWorkspacePath),
      ),
    ].slice(0, 30)
    const active =
      typeof saved.active === "string" ? normalizePath(saved.active) : null
    return { paths, active: active && paths.includes(active) ? active : null }
  } catch {
    return { paths: [], active: null }
  }
}

export function writeWorkspace(key: string, paths: string[], active: string) {
  try {
    if (window.localStorage.getItem("flex-admin-remember-tabs") === "0") {
      window.localStorage.removeItem(key)
      return
    }
    // Persist navigation only. Form values, passwords and API records stay in memory.
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        paths: [...new Set(paths.filter(isWorkspacePath))].slice(0, 30),
        active,
      }),
    )
  } catch {
    /* Navigation remains usable when storage is restricted. */
  }
}
