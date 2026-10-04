import type { PageRecord } from "@/lib/admin-types"

export function publicPagePath(page: PageRecord, pages: PageRecord[]): string {
  if (!page.settings?.use_parent_slugs || !page.parent_id) return page.slug
  const trail = new Set<number>()
  const parts = [page.slug]
  let current = page
  while (current.parent_id && !trail.has(current.id)) {
    trail.add(current.id)
    const parent = pages.find((item) => item.id === current.parent_id)
    if (!parent) break
    parts.unshift(parent.slug)
    current = parent
  }
  return parts.join("/")
}
