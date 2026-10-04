import { useState, type SyntheticEvent } from "react"
import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
export function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError("")
    setSubmitting(true)
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "include",
        headers: { Accept: "application/json" },
      })
      const csrfBody = (await csrfResponse.json().catch(() => ({}))) as { csrf_token?: string }
      if (!csrfResponse.ok || !csrfBody.csrf_token)
        throw new Error("Не можа да бъде получен токен за сигурност.")
      const loginResponse = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfBody.csrf_token,
        },
        body: JSON.stringify({ email, password }),
      })
      const loginBody = (await loginResponse.json().catch(() => ({}))) as {
        user?: { role?: string }
        error?: { message?: string }
      }
      if (!loginResponse.ok) throw new Error(loginBody.error?.message ?? "Входът не беше успешен.")
      if (loginBody.user?.role !== "super_admin")
        throw new Error("Достъпът е разрешен само за супер администратор.")
      toast.success("Входът е успешен.")
      onAuthenticated()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Входът не беше успешен."
      setError(message)
      toast.error(message)
      setSubmitting(false)
    }
  }

  return (
    <main className="react-login-screen flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="text-center">
          <img className="mx-auto h-auto w-52" src="/assets/brand/logo.png" alt="Flex CMS" />
          <p className="react-login-description mt-5">Влезте, за да управлявате сайта.</p>
        </div>
        {error && (
          <div
            className="react-form-error mt-6 flex items-start gap-3 rounded-lg p-3 text-sm font-semibold"
            role="alert"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}
        <form className="mt-7 space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="email">Имейл</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Парола</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Проверка…
              </>
            ) : (
              <>
                Вход <ArrowRight className="ml-2 size-4" />
              </>
            )}
          </Button>
        </form>
      </Card>
    </main>
  )
}
