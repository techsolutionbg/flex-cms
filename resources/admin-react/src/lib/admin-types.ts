export type DashboardSummary = {
  pages: number
  active_plugins: number
  users: number
  version: string
}

export type PlatformUpdateRemote = {
  current_version: string
  channel: string
  available?: {
    version: string
    release_notes?: string
    size: number
    published_at?: string
    channel?: string
  } | null
  error?: string | null
}

export type PlatformRelease = {
  version: string
  release_notes?: string
  size: number
  published_at?: string
  channel?: string
  current?: boolean
  downgrade?: boolean
  installable?: boolean
  blocked_reason?: string | null
}

export type PlatformUpdateHistory = {
  id?: string
  type?: string
  from?: string | null
  to?: string | null
  updated_at?: string | null
  rolled_back_at?: string | null
}

export type PlatformUpdateJob = {
  id: string
  type?: string
  created_at?: string
  started_at?: string | null
  phase?: string
  files_processed?: number
  files_total?: number
  status: "pending" | "running" | "completed" | "failed" | string
  error?: string | null
}

export type PageSettings = {
  template?: string
  menu_order?: number
  use_parent_slugs?: boolean
  show_in_navigation?: boolean
  no_index?: boolean
}

export type PagePluginField = {
  plugin: string
  plugin_name: string
  plugin_version: string
  id: string
  type: "text" | "textarea" | "checkbox"
  label: string
  default: string | boolean
  hint: string
  max_length?: number
}

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
  plugin_settings?: Record<string, Record<string, string | boolean>>
}

export type UserRecord = {
  id: number
  name: string
  email: string
  role: string
  status: string
  deleted_at?: string | null
}

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
  available_release_notes?: string | null
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

export type ThemeRecord = {
  id: string
  name: string
  version: string
  author: string
  description: string
  tags?: string[]
  screenshot_url?: string | null
  supports?: string[]
  active: boolean
  valid: boolean
  error?: string | null
  available_version?: string | null
  release_notes?: string | null
  update_available?: boolean
}

export type ThemeCatalogRecord = {
  id: string
  name: string
  description: string
  author: string
  screenshot_url?: string | null
  tags?: string[]
  version: string
  release_notes?: string | null
  published_at?: string
  size?: number
  installed: boolean
  active: boolean
  installed_version?: string | null
  update_available?: boolean
}
