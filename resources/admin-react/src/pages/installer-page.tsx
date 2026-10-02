import { useEffect, useState, type FormEvent } from "react"
import { ChevronRight, CircleAlert, Database, Globe2, KeyRound, LoaderCircle, Server } from "lucide-react"
import { toast } from "sonner"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/loading-button"

type InstallerField = { name: string; label: string; value: string; type: string; placeholder: string }
type InstallerSection = { title: string; description: string; fields: InstallerField[] }
type InstallerPayload = { csrf_token: string; generated_password: string; sections: InstallerSection[] }

const sectionIcons = [Globe2, Database, KeyRound]

export function InstallerPage() {
  const [payload, setPayload] = useState<InstallerPayload | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/installer-api", { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as Partial<InstallerPayload> & { redirect_url?: string; error?: { message?: string } }
        if (response.status === 404) {
          window.location.replace(body.redirect_url || "/")
          return
        }
        if (!response.ok || !body.csrf_token || !body.sections) throw new Error(body.error?.message ?? "Инсталационната форма не можа да бъде заредена.")
        if (cancelled) return
        const nextPayload = body as InstallerPayload
        setPayload(nextPayload)
        setValues(Object.fromEntries(nextPayload.sections.flatMap((section) => section.fields).map((field) => [field.name, field.value])))
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Инсталационната форма не можа да бъде заредена.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function updateValue(name: string, value: string) { setValues((current) => ({ ...current, [name]: value })) }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!payload || submitting) return
    setError("")
    setSubmitting(true)
    try {
      const form = new URLSearchParams({ csrf_token: payload.csrf_token, ...values })
      const response = await fetch("/installer-api", { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: form })
      const body = await response.json().catch(() => ({})) as { success?: boolean; admin_url?: string; error?: { message?: string } }
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Инсталацията не беше успешна.")
      setCompleted(true)
      toast.success("Flex CMS беше инсталиран успешно.")
      window.setTimeout(() => { window.location.href = body.admin_url || "/" }, 900)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Инсталацията не беше успешна."
      setError(message)
      toast.error(message)
      setSubmitting(false)
    }
  }

  if (loading) return <main className="installer-react-loading"><LoaderCircle className="size-7 animate-spin text-[#ff563d]" /></main>

  return <main className="installer-react-page"><div className="installer-react-shell">
    <header className="installer-react-header"><img src="/assets/brand/logo.png" alt="Flex CMS" /></header>
    <div className="installer-react-intro"><span className="installer-react-kicker">Flex CMS</span><h1>Настройте своя сайт</h1><p>Конфигурирайте основните настройки, свържете базата данни и създайте първия администратор.</p></div>
    {error && <div className="react-form-error" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}
    {completed && <div className="installer-react-success" role="status"><LoaderCircle className="size-5 animate-spin" />Инсталацията приключи. Подготвям административния панел…</div>}
    {!payload && !error ? <div className="installer-react-empty">Няма данни за инсталационната форма.</div> : payload && <form className="installer-react-form" onSubmit={submit}>
      {payload.sections.map((section, sectionIndex) => { const Icon = sectionIcons[sectionIndex] ?? Server; return <CollapsibleSection key={section.title} title={section.title} icon={Icon} storageKey={`installer-${section.title}`}><div className="installer-react-section-description">{section.description}</div><div className="installer-react-fields">{section.fields.map((field) => <div className="installer-react-field" key={field.name}><Label htmlFor={`installer-${field.name}`}>{field.label}</Label><Input id={`installer-${field.name}`} name={field.name} type={field.type} placeholder={field.placeholder} value={values[field.name] ?? ""} onChange={(event) => updateValue(field.name, event.target.value)} disabled={submitting || completed} required />{field.name === "admin_password" && payload.generated_password && <small className="installer-react-generated-password">Генерирана парола: <code>{payload.generated_password}</code>. Сменете я преди използване в реална среда.</small>}</div>)}</div></CollapsibleSection> })}
      <div className="installer-react-actions"><LoadingButton className="installer-react-submit" type="submit" loading={submitting} disabled={completed}>{submitting ? "Инсталиране…" : "Инсталирай Flex CMS"}<ChevronRight className="size-4" /></LoadingButton></div>
    </form>}
  </div></main>
}
