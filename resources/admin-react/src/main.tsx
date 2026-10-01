import { useEffect, useState, type FormEvent } from "react"
import { ArrowRight, CircleAlert, FileText, LoaderCircle, Plus, Puzzle, RefreshCw, UserRound, UsersRound } from "lucide-react"
import { createRoot } from "react-dom/client"
import { Toaster, toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AdminShell } from "@/components/admin-shell"
import { CollapsibleSection } from "@/components/collapsible-section"
import "./index.css"

function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError("")
    setSubmitting(true)
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", headers: { Accept: "application/json" } })
      const csrfBody = await csrfResponse.json().catch(() => ({})) as { csrf_token?: string }
      if (!csrfResponse.ok || !csrfBody.csrf_token) throw new Error("Не можа да бъде получен токен за сигурност.")
      const loginResponse = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": csrfBody.csrf_token }, body: JSON.stringify({ email, password }) })
      const loginBody = await loginResponse.json().catch(() => ({})) as { user?: { role?: string }; error?: { message?: string } }
      if (!loginResponse.ok) throw new Error(loginBody.error?.message ?? "Входът не беше успешен.")
      if (loginBody.user?.role !== "super_admin") throw new Error("Достъпът е разрешен само за супер администратор.")
      toast.success("Входът е успешен.")
      onAuthenticated()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Входът не беше успешен."
      setError(message)
      toast.error(message)
      setSubmitting(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f4f5ef] px-4 py-8"><Card className="w-full max-w-md p-6 sm:p-8"><div className="text-center"><img className="mx-auto h-auto w-52" src="/assets/brand/logo.png" alt="Flex CMS" /><p className="mt-5 text-[#687268]">Влезте, за да управлявате сайта.</p></div>{error && <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#ffb4a8] bg-[#fff0ed] p-3 text-sm font-semibold text-[#b93624]" role="alert"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}<form className="mt-7 space-y-5" onSubmit={submit}><div className="space-y-2"><Label htmlFor="email">Имейл</Label><Input id="email" name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} required /></div><div className="space-y-2"><Label htmlFor="password">Парола</Label><Input id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} required /></div><Button className="w-full" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="mr-2 size-4 animate-spin" />Проверка…</> : <>Вход <ArrowRight className="ml-2 size-4" /></>}</Button></form></Card></main>
}

type DashboardSummary = { pages: number; active_plugins: number; users: number; version: string }

function DashboardPage({ onLogout, loggingOut }: { onLogout: () => void; loggingOut: boolean }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/dashboard", { credentials: "include", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json() as DashboardSummary
        if (!response.ok) throw new Error("Данните за таблото не можаха да бъдат заредени.")
        if (!cancelled) setSummary(body)
      })
      .catch((reason) => { if (!cancelled) toast.error(reason instanceof Error ? reason.message : "Данните за таблото не можаха да бъдат заредени.") })
    return () => { cancelled = true }
  }, [])

  const cards = [
    { title: "Страници", icon: FileText, value: summary?.pages, description: "Създадени страници в системата.", action: "Управление на страниците →" },
    { title: "Разширения", icon: Puzzle, value: summary?.active_plugins, description: "Активни разширения.", action: "Управление на разширенията →" },
    { title: "Потребители", icon: UsersRound, value: summary?.users, description: "Потребители, роли и статуси в системата.", action: "Управление на потребителите →" },
  ]

  return (
    <AdminShell onLogout={onLogout} loggingOut={loggingOut}>
      <h1>Административен панел</h1>
      <p className="admin-lead-react">Имате пълен достъп до системната администрация като супер администратор.</p>
      <section className="dashboard-grid-react" aria-label="Обобщение на системата">
        {cards.map(({ title, icon: Icon, value, description, action }) => <CollapsibleSection title={title} icon={Icon} className="dashboard-card-react" key={title}>
          <strong className="dashboard-stat-react">{value ?? "—"}</strong><p>{description}</p><a href="#" onClick={(event) => event.preventDefault()}>{action}</a>
        </CollapsibleSection>)}
        <CollapsibleSection title="Бързи действия" icon={Plus} className="dashboard-card-react"><div className="dashboard-actions-react"><a href="#" onClick={(event) => event.preventDefault()}><Plus />Нова страница</a><a href="#" onClick={(event) => event.preventDefault()}><RefreshCw />Провери обновявания</a><a href="#" onClick={(event) => event.preventDefault()}><UserRound />Профил</a></div></CollapsibleSection>
        <CollapsibleSection title="Обновявания" icon={RefreshCw} className="dashboard-card-react"><p>Проверка, инсталация и управление на platform пакети.</p><a href="#" onClick={(event) => event.preventDefault()}>Отвори обновявания →</a></CollapsibleSection>
        <CollapsibleSection title="Версия на платформата" icon={RefreshCw} className="dashboard-card-react"><p>Текущата инсталирана версия на Flex CMS.</p><strong className="dashboard-version-react">{summary?.version ?? "—"}</strong></CollapsibleSection>
      </section>
    </AdminShell>
  )
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          headers: { Accept: "application/json" },
        })
        const body = await response.json().catch(() => ({})) as { user?: { role?: string } }
        if (!cancelled) setAuthenticated(response.ok && body.user?.role === "super_admin")
      } catch {
        if (!cancelled) setAuthenticated(false)
      }
    }

    void restoreSession()
    return () => { cancelled = true }
  }, [])

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include", headers: { Accept: "application/json" } })
      const csrfBody = await csrfResponse.json().catch(() => ({})) as { csrf_token?: string }
      if (!csrfResponse.ok || !csrfBody.csrf_token) throw new Error("Не може да бъде получен токен за сигурност.")

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "X-CSRF-Token": csrfBody.csrf_token },
      })
      const body = await response.json().catch(() => ({})) as { error?: { message?: string } }
      if (!response.ok) throw new Error(body.error?.message ?? "Излизането не беше успешно.")

      toast.success("Излязохте успешно.")
      setAuthenticated(false)
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Излизането не беше успешно.")
    } finally {
      setLoggingOut(false)
    }
  }

  if (authenticated === null) {
    return <main className="auth-loading-screen" aria-label="Проверка на сесия"><LoaderCircle className="size-6 animate-spin text-[#ff8062]" /></main>
  }

  return <>
    <Toaster position="top-center" closeButton richColors theme="light" />
    {authenticated ? <DashboardPage onLogout={() => void logout()} loggingOut={loggingOut} /> : <LoginPage onAuthenticated={() => setAuthenticated(true)} />}
  </>
}

createRoot(document.getElementById("root")!).render(<App />)
