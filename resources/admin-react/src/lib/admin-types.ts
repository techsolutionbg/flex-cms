export type DashboardSummary = { pages: number; active_plugins: number; users: number; version: string }

export type PageSettings = {
  template?: string
  menu_order?: number
  use_parent_slugs?: boolean
  show_in_navigation?: boolean
  show_in_sitemap?: boolean
}

export type PagePluginField = { plugin: string; plugin_name: string; plugin_version: string; id: string; type: "text" | "textarea" | "checkbox"; label: string; default: string | boolean; hint: string; max_length?: number }

export type PageRecord = {
  id: number
  title: string
  slug: string
  parent_id?: number | null
  depth?: number
  status: string
  content?: string
  settings?: PageSettings
  updated_at?: string | null
  deleted_at?: string | null
  plugin_fields?: Record<string, Record<string, string | boolean>>
}

export type UserRecord = { id: number; name: string; email: string; role: string; status: string; deleted_at?: string | null }

export type PluginRecord = {
  id: string
  name: string
  version: string
  description: string
  status: "active" | "installed" | "inactive" | "error" | "discovered" | string
  source?: string
  manifest?: Record<string, unknown>
  requested_permissions?: string[]
  approved_permissions?: string[]
  last_error?: string | null
  available_version?: string | null
  update_available?: boolean
}

export type PluginCatalogRecord = {
  id: string
  name: string
  description: string
  author: string
  icon_url?: string
  version: string
  release_notes?: string
  size?: number
  minimum_php?: string
  compatible_from?: string
  minimum_platform_version?: string
  permissions?: string[]
  installation_status: "active" | "installed" | "inactive" | "not_installed" | string
  installed_version?: string | null
  update_available?: boolean
}
