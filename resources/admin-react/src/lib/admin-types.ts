export type DashboardSummary = { pages: number; active_plugins: number; users: number; version: string }

export type PageSettings = {
  template?: string
  menu_order?: number
  use_parent_slugs?: boolean
  show_in_navigation?: boolean
  show_in_sitemap?: boolean
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
}

export type UserRecord = { id: number; name: string; email: string; role: string; status: string; deleted_at?: string | null }
