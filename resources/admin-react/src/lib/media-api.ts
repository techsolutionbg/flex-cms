import { getCsrfToken } from "./admin-api"

export type MediaRecord = {
  id: number
  original_name: string
  mime: string
  size: number
  width: number | null
  height: number | null
  title: string
  alt: string
  caption: string
  description: string
  url: string
  thumbnail_url: string | null
  created_at: string
  uploaded_by: number
  uploader?: { id: number; email: string } | null
  deleted_at: string | null
}
export type MediaIndex = {
  media: MediaRecord[]
  max_bytes: number
  allowed_types?: string[]
  permissions: Record<"view" | "upload" | "edit" | "delete", boolean>
}

export async function mediaRequest<T>(
  url: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
    : AbortSignal.timeout(20000)
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
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error?.message ?? "Медията не може да бъде обработена.")
  return result as T
}

export async function uploadMedia(
  file: File,
  progress: (percent: number) => void,
  signal: AbortSignal,
): Promise<MediaRecord> {
  const token = await getCsrfToken(AbortSignal.any([signal, AbortSignal.timeout(15000)]))
  if (signal.aborted) throw new DOMException("Качването е отменено.", "AbortError")
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const finish = () => signal.removeEventListener("abort", abort)
    xhr.open("POST", "/api/admin/media")
    xhr.withCredentials = true
    xhr.timeout = 300000
    xhr.setRequestHeader("Accept", "application/json")
    xhr.setRequestHeader("X-CSRF-Token", token)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.min(100, Math.round((event.loaded * 100) / event.total)))
    }
    xhr.onload = () => {
      finish()
      let result: { media?: MediaRecord; error?: { message?: string } } = {}
      try {
        result = JSON.parse(xhr.responseText)
      } catch {
        /* Display a useful error for non-JSON responses. */
      }
      if (xhr.status >= 200 && xhr.status < 300 && result.media) resolve(result.media)
      else
        reject(
          new Error(
            result.error?.message ??
              (xhr.status === 413
                ? "Файлът надвишава лимита на сървъра."
                : "Качването не завърши успешно."),
          ),
        )
    }
    xhr.onerror = () => {
      finish()
      reject(new Error("Няма връзка със сървъра."))
    }
    xhr.ontimeout = () => {
      finish()
      reject(new Error("Качването отне твърде дълго. Опитайте отново."))
    }
    xhr.onabort = () => {
      finish()
      reject(new DOMException("Качването е отменено.", "AbortError"))
    }
    signal.addEventListener("abort", abort, { once: true })
    const data = new FormData()
    data.append("file", file)
    xhr.send(data)
  })
}

export function mediaSize(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`
}
