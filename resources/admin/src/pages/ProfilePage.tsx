import { useTheme } from "@/components/theme-provider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminBootstrap } from "@/types"

const themeLabels = {
  system: "Системна",
  light: "Светла",
  dark: "Тъмна",
} as const

export function ProfilePage({ bootstrap }: { bootstrap: AdminBootstrap }) {
  const { theme, setTheme } = useTheme()
  const user = bootstrap.user

  return (
    <>
      <h1>Профил</h1>
      <p className="lead">Основни данни за текущия потребител.</p>
      <section className="content-card profile-card">
        <h2>Данни на потребителя</h2>
        <dl className="profile-details">
          <div>
            <dt>Име</dt>
            <dd>{user?.name ?? "-"}</dd>
          </div>
          <div>
            <dt>Имейл</dt>
            <dd>{user?.email ?? "-"}</dd>
          </div>
          <div>
            <dt>Роля</dt>
            <dd>{user?.role ?? "-"}</dd>
          </div>
          <div>
            <dt>Статус</dt>
            <dd>{user?.status ?? "-"}</dd>
          </div>
        </dl>
      </section>
      <section className="content-card profile-card">
        <h2>Настройки на темата</h2>
        <div className="profile-setting">
          <label htmlFor="theme-select">Тема на приложението</label>
          <Select
            value={theme}
            onValueChange={(value) => {
              if (value === "system" || value === "light" || value === "dark") {
                setTheme(value)
              }
            }}
          >
            <SelectTrigger id="theme-select" className="w-full max-w-sm">
              <SelectValue>{themeLabels[theme]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Системна</SelectItem>
              <SelectItem value="light">Светла</SelectItem>
              <SelectItem value="dark">Тъмна</SelectItem>
            </SelectContent>
          </Select>
          <p className="muted">По подразбиране се използва системната тема.</p>
        </div>
      </section>
    </>
  )
}
