import { ArrowLeft, CheckCircle2, CircleAlert, PackageOpen } from "lucide-react"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ManifestEditor } from "@/components/manifest-editor"
import type { PluginRecord } from "@/lib/admin-types"

type PluginDetailPageProps = { plugin: PluginRecord; onBack: () => void; onLogout: () => void; onNavigate: (label: string) => void; loggingOut: boolean }

const statusLabels: Record<string, string> = { active: "Активно", installed: "Инсталирано", inactive: "Неактивно", error: "Грешка", discovered: "Неинсталирано" }

export function PluginDetailPage({ plugin, onBack, onLogout, onNavigate, loggingOut }: PluginDetailPageProps) {
  const manifest = plugin.manifest ?? {}
  const permissions = plugin.requested_permissions ?? []
  return <AdminShell title={plugin.name} onLogout={onLogout} onNavigate={onNavigate} activeItem="Разширения" loggingOut={loggingOut}>
    <div className="react-page-heading"><div><h1>{plugin.name}</h1><Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Разширения", onClick: onBack }, { label: plugin.name }]} /></div><button type="button" onClick={onBack}><ArrowLeft aria-hidden="true" />Назад към разширенията</button></div>
    <div className="plugin-detail-grid"><section className="react-panel"><div className="plugin-detail-title"><div className="plugin-catalog-icon"><PackageOpen aria-hidden="true" /></div><div><h2>{plugin.name}</h2><span>{plugin.id}</span></div></div><dl className="plugin-detail-list"><div><dt>Версия</dt><dd>{plugin.version || "—"}</dd></div><div><dt>Състояние</dt><dd><span className={`react-status-badge status-${plugin.status}`}><span className="status-dot" />{statusLabels[plugin.status] ?? plugin.status}</span></dd></div><div><dt>Източник</dt><dd>{plugin.source === "catalog" ? "Каталог" : "Локален пакет"}</dd></div></dl><p className="plugin-detail-description">{plugin.description || "Няма описание за това разширение."}</p>{plugin.last_error && <div className="react-inline-error"><CircleAlert aria-hidden="true" />{plugin.last_error}</div>}</section><section className="react-panel"><h2>Разрешения</h2>{permissions.length ? <ul className="plugin-permissions">{permissions.map((permission) => <li key={permission}><CheckCircle2 aria-hidden="true" />{permission}</li>)}</ul> : <p className="react-muted">Разширението не заявява специални разрешения.</p>}</section></div>
    <section className="react-panel plugin-manifest-panel"><h2>Manifest</h2><ManifestEditor value={manifest} /></section>
  </AdminShell>
}
