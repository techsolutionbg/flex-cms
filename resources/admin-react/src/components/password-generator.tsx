import { KeyRound } from "lucide-react"

const PASSWORD_GROUPS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*()-_=+",
]
const PASSWORD_CHARACTERS = PASSWORD_GROUPS.join("")

function secureIndex(max: number): number {
  const range = 0x1_0000_0000
  const limit = range - (range % max)
  const value = new Uint32Array(1)
  do {
    crypto.getRandomValues(value)
  } while (value[0] >= limit)
  return value[0] % max
}

function generateSecurePassword(length: number): string {
  const password = PASSWORD_GROUPS.map((group) => group[secureIndex(group.length)])
  while (password.length < length)
    password.push(PASSWORD_CHARACTERS[secureIndex(PASSWORD_CHARACTERS.length)])

  for (let index = password.length - 1; index > 0; index--) {
    const swapIndex = secureIndex(index + 1)
    ;[password[index], password[swapIndex]] = [password[swapIndex], password[index]]
  }

  return password.join("")
}

/** Generates a cryptographically secure password and returns it to the caller's chosen field(s). */
export function PasswordGenerator({
  onGenerate,
  length = 24,
  disabled = false,
}: {
  onGenerate: (password: string) => void
  length?: number
  disabled?: boolean
}) {
  const requestedLength = Number.isFinite(length) ? Math.floor(length) : 24
  const safeLength = Math.min(72, Math.max(12, requestedLength))

  return (
    <button
      type="button"
      className="password-generator-button"
      disabled={disabled}
      onClick={() => onGenerate(generateSecurePassword(safeLength))}
    >
      <KeyRound size={16} aria-hidden="true" />
      Генерирай парола
    </button>
  )
}
