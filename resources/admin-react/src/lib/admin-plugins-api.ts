import type { PluginRecord } from "@/lib/admin-types"

const CACHE_MS = 45_000

let memory: { plugins: PluginRecord[]; fetchedAt: number } | null = null

export function readCachedAdminPlugins(): PluginRecord[] | null {
  if (!memory || Date.now() - memory.fetchedAt > CACHE_MS) return null
  return memory.plugins
}

export function writeCachedAdminPlugins(plugins: PluginRecord[]) {
  memory = { plugins, fetchedAt: Date.now() }
}

export function invalidateAdminPluginsCache() {
  memory = null
}

export async function fetchAdminPlugins(options?: {
  signal?: AbortSignal
  force?: boolean
  /** Bypass the server snapshot and rebuild from disk and the update catalog. */
  refresh?: boolean
}): Promise<PluginRecord[]> {
  if (!options?.force && !options?.refresh) {
    const cached = readCachedAdminPlugins()
    if (cached) return cached
  }
  const url = options?.refresh
    ? "/api/admin/plugins?refresh=1"
    : "/api/admin/plugins"
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options?.refresh ? { "X-Flex-Refresh": "1" } : {}),
    },
    signal: options?.signal,
  })
  const body = (await response.json().catch(() => ({}))) as {
    plugins?: PluginRecord[]
    error?: { message?: string }
  }
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Разширенията не можаха да бъдат заредени.")
  }
  const plugins = body.plugins ?? []
  writeCachedAdminPlugins(plugins)
  return plugins
}
