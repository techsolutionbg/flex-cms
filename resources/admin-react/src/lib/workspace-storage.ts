const simplePaths = new Set([
  "/",
  "/pages",
  "/menus",
  "/menus/create",
  "/users",
  "/profile",
  "/themes",
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
      /^\/pages\/\d+\/(edit|settings)$/.test(value) ||
      /^\/users\/\d+\/edit$/.test(value) ||
      /^\/menus\/\d+\/edit$/.test(value) ||
      /^\/menus\/\d+\/structure$/.test(value) ||
      /^\/plugins\/[a-zA-Z0-9._-]+$/.test(value))
  )
}

export function readWorkspace(key: string): { paths: string[]; active: string | null } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null")
    if (saved?.version !== 1 || !Array.isArray(saved.paths)) return { paths: [], active: null }
    const paths = [...new Set<string>(saved.paths.filter(isWorkspacePath))].slice(0, 30)
    return { paths, active: paths.includes(saved.active) ? saved.active : null }
  } catch {
    return { paths: [], active: null }
  }
}

export function writeWorkspace(key: string, paths: string[], active: string) {
  try {
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
