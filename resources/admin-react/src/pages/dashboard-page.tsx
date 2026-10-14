import { t } from "@/lib/admin-i18n"
import { useEffect, useState, type MouseEvent } from "react"
import { FileText, Plus, Puzzle, RefreshCw, UserRound, UsersRound } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { CollapsibleSection } from "@/components/collapsible-section"
import type { DashboardSummary } from "@/lib/admin-types"
import { adminUrl } from "@/lib/admin-routes"
export function DashboardPage({
  onLogout,
  onNavigate,
  loggingOut,
  onCreatePage,
}: {
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
  onCreatePage?: () => void
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  function follow(event: MouseEvent<HTMLAnchorElement>, action?: () => void) {
    if (
      !action ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    action()
  }

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/dashboard", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as DashboardSummary
        if (!response.ok) throw new Error("Данните за таблото не можаха да бъдат заредени.")
        if (!cancelled) setSummary(body)
      })
      .catch((reason) => {
        if (!cancelled)
          toast.error(
            reason instanceof Error
              ? reason.message
              : "Данните за таблото не можаха да бъдат заредени.",
          )
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cards = [
    {
      title: "Страници",
      path: "/pages",
      icon: FileText,
      value: summary?.pages,
      description: "Създадени страници в системата.",
      action: "Управление на страниците →",
    },
    {
      title: "Разширения",
      path: "/plugins",
      icon: Puzzle,
      value: summary?.active_plugins,
      description: "Активни разширения.",
      action: "Управление на разширенията →",
    },
    {
      title: "Потребители",
      path: "/users",
      icon: UsersRound,
      value: summary?.users,
      description: "Потребители, роли и статуси в системата.",
      action: "Управление на потребителите →",
    },
  ]

  return (
    <AdminShell
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Табло"
      loggingOut={loggingOut}
    >
      <h1>{t("Admin panel")}</h1>
      <section className="dashboard-grid-react" aria-label={t("System overview")}>
        {cards.map(({ title, path, icon: Icon, value, description, action }) => (
          <CollapsibleSection
            extensionPoint={`dashboard${path.replace(/\//g, ".")}`}
            title={t(title)}
            icon={Icon}
            className="dashboard-card-react"
            key={title}
          >
            <strong className="dashboard-stat-react">{value ?? "—"}</strong>
            <p>{t(description)}</p>
            <a href={adminUrl(path)} onClick={(event) => follow(event, () => onNavigate(title))}>
              {t(action)}
            </a>
          </CollapsibleSection>
        ))}
        <CollapsibleSection
          extensionPoint="dashboard.quick-actions"
          title={t("Quick actions")}
          icon={Plus}
          className="dashboard-card-react"
        >
          <div className="dashboard-actions-react">
            <a href={adminUrl("/pages/create")} onClick={(event) => follow(event, onCreatePage)}>
              <Plus />

              {t("New page")}
            </a>
            <a
              href={adminUrl("/updates")}
              onClick={(event) => follow(event, () => onNavigate("Обновявания"))}
            >
              <RefreshCw />

              {t("Check for updates")}
            </a>
            <a
              href={adminUrl("/profile")}
              onClick={(event) => follow(event, () => onNavigate("Профил"))}
            >
              <UserRound />

              {t("Profile")}
            </a>
          </div>
        </CollapsibleSection>
        <CollapsibleSection
          extensionPoint="dashboard.updates"
          title={t("Updates")}
          icon={RefreshCw}
          className="dashboard-card-react"
        >
          <p>{t("Platform packages can be checked, installed, and managed here.")}</p>
          <a
            href={adminUrl("/updates")}
            onClick={(event) => follow(event, () => onNavigate("Обновявания"))}
          >

            {t("Open updates →")}
          </a>
        </CollapsibleSection>
        <CollapsibleSection
          extensionPoint="dashboard.version"
          title={t("Platform version")}
          icon={RefreshCw}
          className="dashboard-card-react"
        >
          <p>{t("Currently installed Flex CMS version.")}</p>
          <strong className="dashboard-version-react">{summary?.version ?? "—"}</strong>
        </CollapsibleSection>
      </section>
    </AdminShell>
  )
}
