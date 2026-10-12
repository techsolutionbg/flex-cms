import { getCsrfToken } from "@/lib/admin-api"

export type ThemeRecordItem = {
  id: number
  title: string
  slug: string
  summary: string
  content: string
  status: "draft" | "published"
  featured_media_id: number | null
  featured_media?: {
    id: number
    title: string
    alt: string
    url: string
    thumbnail_url: string | null
  } | null
  published_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export async function themeResourceRequest<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (method !== "GET") {
    headers["Content-Type"] = "application/json"
    headers["X-CSRF-Token"] = await getCsrfToken()
  }
  const response = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; fields?: Record<string, string[]> }
  }
  if (!response.ok) {
    const fieldMessage = Object.values(payload.error?.fields ?? {})
      .flat()
      .find((item) => item.trim() !== "")
    throw new Error(fieldMessage ?? payload.error?.message ?? "Заявката не успя.")
  }
  return payload as T
}
