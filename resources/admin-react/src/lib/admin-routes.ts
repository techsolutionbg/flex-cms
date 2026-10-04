declare const __FLEX_ADMIN_BASE__: string

export const adminBasePath = typeof __FLEX_ADMIN_BASE__ === "string" ? __FLEX_ADMIN_BASE__.replace(/\/$/, "") : ""

export function adminUrl(path = "/") {
  const route = path.startsWith("/") ? path : `/${path}`
  return `${adminBasePath}${route === "/" ? "" : route}` || "/"
}

export function adminRoute(pathname = window.location.pathname) {
  if (!adminBasePath) return pathname || "/"
  if (pathname === adminBasePath) return "/"
  if (pathname.startsWith(`${adminBasePath}/`)) return pathname.slice(adminBasePath.length) || "/"
  // /login remains a compatibility entry point and is served by the same SPA.
  return pathname || "/"
}

export function adminRedirectTarget(search = window.location.search) {
  const requested = new URLSearchParams(search).get("redirect")
  if (!requested || !requested.startsWith("/") || requested.startsWith("//")) return adminUrl("/")

  const route = adminRoute(requested)
  if (route === "/login" || route === "/install" || route.startsWith("/api/")) return adminUrl("/")
  return adminUrl(route)
}
