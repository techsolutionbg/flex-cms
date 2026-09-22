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
  page: "dashboard" | "updates"
  csrfToken: string
  sidebarWidth: number
  version: string
  history?: HistoryRecord[]
  notice?: string | null
  error?: string | null
  inspection?: Inspection | null
}
