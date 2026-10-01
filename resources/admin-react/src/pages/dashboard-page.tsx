import { useEffect, useState } from "react"
import { FileText, Plus, Puzzle, RefreshCw, UserRound, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { CollapsibleSection } from "@/components/collapsible-section"
import type { DashboardSummary } from "@/lib/admin-types"
export function DashboardPage({ onLogout, onNavigate, loggingOut }: { onLogout: () => void; onNavigate: (label: string) => void; loggingOut: boolean }) {
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
    <AdminShell onLogout={onLogout} onNavigate={onNavigate} activeItem="Табло" loggingOut={loggingOut}>
      <h1>Административен панел</h1>
      <section className="dashboard-release-notice" aria-label="Последна промяна">
        <div className="dashboard-release-notice-mark">NEW</div>
        <div><strong>Подобрено управление на обновяванията</strong><p>Тази визуална промяна служи като маркер за успешно инсталиране на следващия релийз.</p></div>
      </section>
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
