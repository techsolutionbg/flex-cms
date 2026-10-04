export async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "include",
    headers: { Accept: "application/json" },
  })
  const body = (await response.json().catch(() => ({}))) as { csrf_token?: string }
  if (!response.ok || !body.csrf_token)
    throw new Error("Не може да бъде получен токен за сигурност.")
  return body.csrf_token
}
