import { useCallback, useEffect, useState } from "react"
import { FlaskConical, RefreshCw, Trash2 } from "lucide-react"
import { CodeEditor } from "./code-editor"
import { LoadingButton } from "./loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import { toast } from "sonner"

export function OperationErrorsLog({ revision }: { revision: number }) {
  const [path, setPath] = useState("storage/logs/operation-errors.jsonl")
  const [content, setContent] = useState("")
  const [lines, setLines] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/operation-errors", {
        credentials: "include",
        signal: AbortSignal.timeout(20000),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message ?? "Грешка при зареждане.")
      setPath(typeof body.path === "string" ? body.path : "storage/logs/operation-errors.jsonl")
      setContent(typeof body.content === "string" ? body.content : "")
      setLines(typeof body.lines === "number" ? body.lines : 0)
      setTruncated(body.truncated === true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Дневникът не можа да бъде зареден.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, revision])

  async function triggerTestError() {
    if (testing) return
    setTesting(true)
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/admin/operation-errors/test", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "X-CSRF-Token": token },
        signal: AbortSignal.timeout(20000),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Тестовият запис не успя.")
      }
      toast.success("Тестовият запис е добавен в дневника.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Тестовият запис не успя.")
    } finally {
      setTesting(false)
      await load()
    }
  }

  async function clearLog() {
    if (clearing || lines === 0) return
    setClearing(true)
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/admin/operation-errors", {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRF-Token": token },
        signal: AbortSignal.timeout(20000),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message ?? "Грешка при изчистване.")
      setContent("")
      setLines(0)
      setTruncated(false)
      toast.success("Дневникът е изчистен.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Дневникът не можа да бъде изчистен.")
    } finally {
      setClearing(false)
    }
  }

  const emptyHint =
    lines === 0 && !loading
      ? "# Няма записи. Грешките от сървърни операции се добавят тук автоматично (JSON Lines).\n"
      : ""

  return (
    <CodeEditor
      value={loading && content === "" ? "# Зареждане…\n" : content || emptyHint}
      language="plaintext"
      readOnly
      height="420px"
      enableFormat={false}
      copyLabel="Копирай дневника"
      toolbarContent={
        <>
          <span className="operation-errors-log-meta">
            {path}
            {lines > 0 ? ` · ${lines} запис${lines === 1 ? "" : "а"}` : " · празен"}
            {truncated ? " · съкратен изглед" : ""}
          </span>
          <LoadingButton type="button" loading={loading} onClick={() => void load()}>
            <RefreshCw aria-hidden="true" />
            Презареди
          </LoadingButton>
          <LoadingButton type="button" loading={testing} onClick={() => void triggerTestError()}>
            <FlaskConical aria-hidden="true" />
            Тестова грешка
          </LoadingButton>
          <LoadingButton
            type="button"
            className="is-danger"
            loading={clearing}
            disabled={lines === 0}
            onClick={() => void clearLog()}
          >
            <Trash2 aria-hidden="true" />
            Изчисти
          </LoadingButton>
        </>
      }
    />
  )
}
