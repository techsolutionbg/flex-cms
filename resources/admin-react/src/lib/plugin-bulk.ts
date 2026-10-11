import type { PluginRecord } from "./admin-types"

export type PluginBulkAction = "install" | "activate" | "deactivate" | "update_remote" | "uninstall"

/** Whether the action applies to the plugin as it is now, as in its own actions menu. */
export function canRun(action: PluginBulkAction, plugin: PluginRecord): boolean {
  switch (action) {
    case "install":
      return plugin.status === "discovered"
    case "activate":
      return plugin.status !== "discovered" && plugin.status !== "active"
    case "deactivate":
      return plugin.status === "active"
    case "update_remote":
      return plugin.status !== "discovered" && plugin.update_available === true
    case "uninstall":
      return plugin.status !== "discovered"
  }
}

function requirements(plugin: PluginRecord): string[] {
  const metadata = plugin.manifest?.metadata
  const requires =
    metadata && typeof metadata === "object" ? (metadata as { requires?: unknown }).requires : undefined
  return Array.isArray(requires) ? requires.filter((id): id is string => typeof id === "string") : []
}

/**
 * The plugins the action applies to, in a safe order: plugins others require come first when installing,
 * activating or updating, and last when deactivating or removing. Otherwise the list order is kept.
 */
export function bulkTargets(action: PluginBulkAction, plugins: PluginRecord[]): PluginRecord[] {
  const targets = plugins.filter((plugin) => canRun(action, plugin))
  const byId = new Map(targets.map((plugin) => [plugin.id, plugin]))
  const ordered: PluginRecord[] = []
  const visiting = new Set<string>()
  const visit = (plugin: PluginRecord) => {
    if (ordered.includes(plugin) || visiting.has(plugin.id)) return
    visiting.add(plugin.id)
    for (const id of requirements(plugin)) {
      const required = byId.get(id)
      if (required) visit(required)
    }
    visiting.delete(plugin.id)
    ordered.push(plugin)
  }
  targets.forEach(visit)
  return action === "deactivate" || action === "uninstall" ? ordered.reverse() : ordered
}
