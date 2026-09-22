export type HistoryRecord = {
  type?: string
  id?: string
  from?: string
  to?: string
  installed_at?: string
  rolled_back_at?: string
  migrations_ran?: boolean
}

export type Inspection = {
  version?: string
  files?: number
  migrations?: boolean
}

export type AdminBootstrap = {
  page: "dashboard" | "updates" | "profile" | "pages"
  csrfToken: string
  sidebarWidth: number
  version: string
  history?: HistoryRecord[]
  notice?: string | null
  error?: string | null
  inspection?: Inspection | null
  user?: {
    id: number
    name: string
    email: string
    role: string
    status: string
  }
  pages?: PageRecord[]
}

export type PageRecord = {
  id: number
  author_id: number | null
  title: string
  slug: string
  content: string
  status: "draft" | "published"
  published_at: string | null
  created_at: string | null
  updated_at: string | null
}
