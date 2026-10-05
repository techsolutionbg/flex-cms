import { getCsrfToken } from "./admin-api"
import type { ThemeCapabilities } from "@/components/admin-workspace-context"
export type MenuItem = {
  id: string
  parent_id: string | null
  label: string
  type: "page" | "link"
  page_id: number | null
  url: string
  new_tab: boolean
  seo_title?: string
  aria_label?: string
  css_class?: string
  rel?: string
}
export type MenuStatus = "active" | "inactive" | "draft"
export type MenuRecord = {
  id: number
  name: string
  slug: string
  status: MenuStatus
  version: number
  items: MenuItem[]
}
export type MenuSummary = Omit<MenuRecord, "items"> & {
  deleted_at: string | null
  item_count: number
  assignments: { theme: string; location: string }[]
}
export type MenuIndex = ThemeCapabilities & {
  menus: MenuSummary[]
  assignments: Record<string, number>
  assignment_version: string
  pages: { id: number; title: string; status: string }[]
}
export async function menuRequest<T>(
  url: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(20000),
    requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  const headers: Record<string, string> = { Accept: "application/json" }
  if (method !== "GET") {
    headers["Content-Type"] = "application/json"
    headers["X-CSRF-Token"] = await getCsrfToken(requestSignal)
  }
  const response = await fetch(url, {
    method,
    headers,
    credentials: "include",
    cache: "no-store",
    signal: requestSignal,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error?.message ?? "Менютата не можаха да бъдат обновени.")
  return data as T
}
export function descendants(items: MenuItem[], id: string): Set<string> {
  const found = new Set([id])
  let changed = true
  while (changed) {
    changed = false
    for (const item of items)
      if (item.parent_id && found.has(item.parent_id) && !found.has(item.id)) {
        found.add(item.id)
        changed = true
      }
  }
  return found
}
export function canParent(items: MenuItem[], id: string, parent: string | null): boolean {
  if (parent && descendants(items, id).has(parent)) return false
  const next = items.map((item) => (item.id === id ? { ...item, parent_id: parent } : item))
  return next.every((item) => {
    const trail = new Set([item.id])
    let ancestor = item.parent_id
    let depth = 1
    while (ancestor) {
      if (trail.has(ancestor) || ++depth > 3) return false
      trail.add(ancestor)
      const match = next.find((candidate) => candidate.id === ancestor)
      if (!match) return false
      ancestor = match.parent_id
    }
    return true
  })
}
export function moveItem(items: MenuItem[], id: string, target: string): MenuItem[] {
  const from = items.findIndex((item) => item.id === id),
    to = items.findIndex((item) => item.id === target)
  if (from < 0 || to < 0 || items[from].parent_id !== items[to].parent_id) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function orderedMenuItems(items: MenuItem[]): MenuItem[] {
  const ordered: MenuItem[] = []
  const visit = (parent: string | null, depth: number) => {
    if (depth > 3) return
    for (const item of items.filter((entry) => entry.parent_id === parent)) {
      ordered.push(item)
      visit(item.id, depth + 1)
    }
  }
  visit(null, 1)
  return ordered
}

export type MenuDropMode = "before" | "after" | "inside" | "outdent"

export function placeMenuItem(
  items: MenuItem[],
  id: string,
  targetId: string,
  mode: MenuDropMode,
): MenuItem[] {
  const ordered = orderedMenuItems(items)
  const item = ordered.find((entry) => entry.id === id)
  if (!item) return items
  let target = ordered.find((entry) => entry.id === targetId)
  let parent: string | null
  if (mode === "outdent") {
    target = ordered.find((entry) => entry.id === item.parent_id)
    if (!target) return items
    parent = target.parent_id
  } else {
    if (mode === "inside" && targetId === id)
      target = ordered[ordered.findIndex((entry) => entry.id === id) - 1]
    if (!target || target.id === id) return items
    parent = mode === "inside" ? target.id : target.parent_id
  }
  const branch = descendants(items, id)
  if (mode === "inside" && targetId === id && parent === item.parent_id) return items
  if (!target || branch.has(target.id) || !canParent(items, id, parent)) return items
  const remaining = ordered.filter((entry) => !branch.has(entry.id))
  let index = remaining.findIndex((entry) => entry.id === target.id)
  if (mode !== "before") {
    const targetBranch = descendants(remaining, target.id)
    while (index < remaining.length && targetBranch.has(remaining[index].id)) index++
  }
  const moving = ordered
    .filter((entry) => branch.has(entry.id))
    .map((entry) => (entry.id === id ? { ...entry, parent_id: parent } : entry))
  return [...remaining.slice(0, index), ...moving, ...remaining.slice(index)]
}
