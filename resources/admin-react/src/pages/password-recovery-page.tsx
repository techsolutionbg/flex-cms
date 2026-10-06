import { useEffect, useState, type SyntheticEvent } from "react"
import { ArrowLeft, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getCsrfToken } from "@/lib/admin-api"

export function PasswordRecoveryPage({
  onBack,
  initialEmail,
}: {
  onBack: () => void
  initialEmail: string
}) {
  const [stage, setStage] = useState<"request" | "verify" | "reset" | "done">("request")
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState("")
  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.ceil((resendAt - now) / 1000))

  async function send(operation: "request" | "verify" | "reset") {
    if (busy) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const signal = AbortSignal.timeout(20000)
      const csrf = await getCsrfToken(signal)
      const response = await fetch(`/api/auth/password/${operation}`, {
        method: "POST",
        credentials: "include",
        signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({
          email,
          code,
          reset_token: token,
          password,
          password_confirmation: confirmation,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        if (response.status === 429)
          setResendAt(Date.now() + Number(response.headers.get("Retry-After") || 60) * 1000)
        throw new Error(body.error?.message ?? "Заявката не беше успешна.")
      }
      if (operation === "request") {
        setEmail(email.trim().toLowerCase())
        setStage("verify")
        setCode("")
        setResendAt(Date.now() + body.resend_after * 1000)
        setMessage(body.message)
      } else if (operation === "verify") {
        setToken(body.reset_token)
        setCode("")
        setStage("reset")
      } else {
        setToken("")
        setPassword("")
        setConfirmation("")
        setStage("done")
        setMessage(body.message)
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Заявката не беше успешна.")
    } finally {
      setBusy(false)
    }
  }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (stage !== "done") await send(stage)
  }
  return (
    <main className="react-login-screen flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="text-center">
          <div className="react-login-brand mx-auto w-52">
            <img className="h-auto w-full" src="/assets/brand/logo.png" alt="Flex CMS" />
          </div>
          <h1 className="mt-5 text-xl">Възстановяване на парола</h1>
          <p className="react-login-description mt-3">
            {stage === "request"
              ? "Въведете имейла на административния си профил."
              : stage === "verify"
                ? `Въведете шестцифрения код, изпратен до ${email}. Валиден е 15 минути.`
                : stage === "reset"
                  ? "Задайте нова парола. Потвърждението е валидно 5 минути."
                  : "Можете да влезете с новата си парола."}
          </p>
        </div>
        {error && (
          <p role="alert" className="react-form-error mt-5">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="react-login-description mt-5">
            {message}
          </p>
        )}
        {stage !== "done" && (
          <form className="mt-7 space-y-5" onSubmit={submit}>
            {stage === "request" && (
              <div className="space-y-2">
                <Label htmlFor="recovery-email">Имейл</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={190}
                  value={email}
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            )}
            {stage === "verify" && (
              <div className="space-y-2">
                <Label htmlFor="recovery-code">Код за потвърждение</Label>
                <Input
                  id="recovery-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  disabled={busy}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                />
              </div>
            )}
            {stage === "reset" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="recovery-password">Нова парола</Label>
                  <Input
                    id="recovery-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                    value={password}
                    disabled={busy}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <small className="react-field-hint">Поне 12 знака.</small>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recovery-confirmation">Повторете паролата</Label>
                  <Input
                    id="recovery-confirmation"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={72}
                    value={confirmation}
                    disabled={busy}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </div>
              </>
            )}
            <Button className="w-full" disabled={busy} type="submit">
              {busy ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                  Изпращане…
                </>
              ) : stage === "request" ? (
                "Изпрати код"
              ) : stage === "verify" ? (
                "Потвърди кода"
              ) : (
                "Запази новата парола"
              )}
            </Button>
          </form>
        )}
        {stage === "verify" && (
          <Button
            variant="secondary"
            className="mt-4 w-full"
            type="button"
            disabled={busy || seconds > 0}
            onClick={() => void send("request")}
          >
            {seconds > 0 ? `Нов код след ${seconds} сек.` : "Изпрати нов код"}
          </Button>
        )}
        {stage === "reset" && (
          <Button
            variant="secondary"
            className="mt-4 w-full"
            type="button"
            disabled={busy}
            onClick={() => {
              setStage("request")
              setToken("")
              setPassword("")
              setConfirmation("")
              setError("")
            }}
          >
            Заяви нов код
          </Button>
        )}
        <Button
          variant="secondary"
          className="mt-5 w-full"
          type="button"
          disabled={busy}
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          Назад към входа
        </Button>
      </Card>
    </main>
  )
}
