import { t } from "@/lib/admin-i18n"
import {
  ArrowLeft,
  Braces,
  CheckCircle2,
  CircleAlert,
  Code2,
  PackageOpen,
  ShieldCheck,
} from "lucide-react"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ManifestEditor } from "@/components/manifest-editor"
import { PluginSourceViewer } from "@/components/plugin-source-viewer"
import { CollapsibleSection } from "@/components/collapsible-section"
import type { PluginRecord } from "@/lib/admin-types"

type PluginDetailPageProps = {
  plugin: PluginRecord
  onBack: () => void
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
}

const statusLabels: Record<string, string> = {
  active: "Active",
  installed: "Installed",
  inactive: "Inactive",
  error: "Error",
  discovered: "Not installed status",
}

export function PluginDetailPage({
  plugin,
  onBack,
  onLogout,
  onNavigate,
  loggingOut,
}: PluginDetailPageProps) {
  const manifest = plugin.manifest ?? {}
  const permissions = plugin.requested_permissions ?? []
  return (
    <AdminShell
      title={plugin.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      activeItem="Разширения"
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{plugin.name}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[{ label: "Разширения", onClick: onBack }, { label: plugin.name }]}
          />
          <p className="plugin-detail-description">
            {plugin.description || t("No description is available for this extension.")}
          </p>
        </div>
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />

          {t("Back to extensions")}
        </button>
      </div>
      <CollapsibleSection
        extensionPoint="plugin.detail.source"
        title={t("Extension code")}
        icon={Code2}
        className="plugin-source-first-section"
        storageKey={`plugin:${plugin.id}:source`}
      >
        <PluginSourceViewer pluginId={plugin.id} />
      </CollapsibleSection>
      <div className="plugin-detail-grid">
        <CollapsibleSection
          extensionPoint="plugin.detail.information"
          title={t("Extension information")}
          icon={PackageOpen}
          storageKey={`plugin:${plugin.id}:information`}
        >
          <div className="plugin-detail-title">
            <div className="plugin-catalog-icon">
              <PackageOpen aria-hidden="true" />
            </div>
            <div>
              <h2>{plugin.name}</h2>
              <span>{plugin.id}</span>
            </div>
          </div>
          <dl className="plugin-detail-list">
            <div>
              <dt>{t("Version")}</dt>
              <dd>{plugin.version || "—"}</dd>
            </div>
            <div>
              <dt>{t("State")}</dt>
              <dd>
                <span className={`react-status-badge status-${plugin.status}`}>
                  <span className="status-dot" />
                  {t(statusLabels[plugin.status] ?? plugin.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t("Source")}</dt>
              <dd>{plugin.source === "catalog" ? t("Catalog") : t("Local package")}</dd>
            </div>
          </dl>
          {plugin.last_error && (
            <div className="react-inline-error">
              <CircleAlert aria-hidden="true" />
              {plugin.last_error}
            </div>
          )}
        </CollapsibleSection>
        <CollapsibleSection
          extensionPoint="plugin.detail.permissions"
          title={t("Permissions")}
          icon={ShieldCheck}
          storageKey={`plugin:${plugin.id}:permissions`}
        >
          {permissions.length ? (
            <ul className="plugin-permissions">
              {permissions.map((permission) => (
                <li key={permission}>
                  <CheckCircle2 aria-hidden="true" />
                  {permission}
                </li>
              ))}
            </ul>
          ) : (
            <p className="react-muted">{t("This extension does not request any special permissions.")}</p>
          )}
        </CollapsibleSection>
      </div>
      <CollapsibleSection
        extensionPoint="plugin.detail.manifest"
        title="Manifest"
        icon={Braces}
        className="plugin-manifest-panel"
        storageKey={`plugin:${plugin.id}:manifest`}
      >
        <ManifestEditor value={manifest} />
      </CollapsibleSection>
    </AdminShell>
  )
}
