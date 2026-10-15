import { t } from "@/lib/admin-i18n"
import { useEffect, useState } from "react"
import { ArrowLeft, CheckCircle2, CircleAlert, Code2, Info, PackageOpen, Settings2 } from "lucide-react"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ExtensionComponent, useExtensions } from "@/components/extension-runtime"
import { PluginSourceViewer } from "@/components/plugin-source-viewer"
import { CollapsibleSection } from "@/components/collapsible-section"
import { Tooltip } from "@/components/ui/tooltip"
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

const permissionDetails: Record<string, { title: string; description: string }> = {
  "admin.ui": {
    title: "Administrative interface",
    description: "Adds custom pages, tabs, panels, and fields to the admin panel.",
  },
  "events.listen": {
    title: "Platform event access",
    description: "Lets the extension react to platform events and changes.",
  },
  "routes.admin": {
    title: "Admin routes",
    description: "Registers API routes for the admin area of the site.",
  },
  "routes.public": {
    title: "Public routes",
    description: "Adds routes that visitors can access on the public site.",
  },
  "frontend.assets": {
    title: "Site assets",
    description: "Loads CSS and JavaScript files in the public part of the site.",
  },
  "content.blocks": {
    title: "Content blocks",
    description: "Adds custom blocks to content editors.",
  },
  "storage.documents": {
    title: "Data storage",
    description: "Stores data isolated for this extension.",
  },
  "mail.send": {
    title: "Email sending",
    description: "Sends email through the platform mail service.",
  },
  "theme.extensions": {
    title: "Active theme access",
    description: "Reads files, settings, and extensions of the active theme.",
  },
}

type PluginDetailTab = "details" | "settings"

function readPluginDetailTab(): PluginDetailTab {
  return new URLSearchParams(window.location.search).get("tab") === "settings" ? "settings" : "details"
}

export function PluginDetailPage({
  plugin,
  onBack,
  onLogout,
  onNavigate,
  loggingOut,
}: PluginDetailPageProps) {
  const [activeTab, setActiveTab] = useState<PluginDetailTab>(readPluginDetailTab)
  useEffect(() => {
    const syncTabFromUrl = () => setActiveTab(readPluginDetailTab())
    window.addEventListener("popstate", syncTabFromUrl)
    return () => window.removeEventListener("popstate", syncTabFromUrl)
  }, [])
  function selectTab(tab: PluginDetailTab) {
    setActiveTab(tab)
    const params = new URLSearchParams(window.location.search)
    if (tab === "details") params.delete("tab")
    else params.set("tab", tab)
    const query = params.toString()
    window.history.pushState(
      {},
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    )
  }
  const permissions = plugin.requested_permissions ?? []
  const settingsPanels = useExtensions("settings", "screen.tab").filter(
    (panel) => panel.plugin === plugin.id,
  )
  const tabs = [
    { id: "details" as const, label: "Information" },
    { id: "settings" as const, label: "Settings" },
  ]
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
        </div>
      </div>
      <div className="admin-workspace-tabbar plugin-detail-tabbar">
        <div
          className="admin-workspace-tabs"
          role="tablist"
          aria-label={t("Extension detail tabs")}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
            event.preventDefault()
            const currentIndex = tabs.findIndex((tab) => tab.id === activeTab)
            const nextIndex =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                    tabs.length
            const nextTab = tabs[nextIndex]
            selectTab(nextTab.id)
            requestAnimationFrame(() =>
              document.getElementById(`plugin-detail-tab-${nextTab.id}`)?.focus(),
            )
          }}
        >
          {tabs.map(({ id, label }) => (
            <div className="admin-workspace-tab" data-active={activeTab === id} key={id}>
              <Tooltip content={label}>
                <button
                  type="button"
                  role="tab"
                  id={`plugin-detail-tab-${id}`}
                  aria-label={t(label)}
                  aria-selected={activeTab === id}
                  aria-controls={`plugin-detail-panel-${id}`}
                  tabIndex={activeTab === id ? 0 : -1}
                  onClick={() => selectTab(id)}
                >
                  {id === "details" ? <Info aria-hidden="true" /> : <Settings2 aria-hidden="true" />}
                  <span className="admin-workspace-tab-title">{t(label)}</span>
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
      <div
        id="plugin-detail-panel-details"
        className="plugin-detail-tab-panel"
        role="tabpanel"
        aria-label={t("Extension details")}
        aria-labelledby="plugin-detail-tab-details"
        hidden={activeTab !== "details"}
        tabIndex={0}
      >
        <CollapsibleSection
          extensionPoint="plugin.detail.source"
          title={t("Extension code")}
          icon={Code2}
          className="plugin-source-first-section"
          storageKey={`plugin:${plugin.id}:source`}
        >
          <PluginSourceViewer pluginId={plugin.id} />
        </CollapsibleSection>
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
          <div className="plugin-detail-copy">
            <h3>{t("Description")}</h3>
            <p className="plugin-detail-description">
              {plugin.description
                ? t(plugin.description, plugin.id)
                : t("No description is available for this extension.")}
            </p>
          </div>
          <div className="plugin-detail-release-notes">
            <h3>
              {t("What's new")} <span>{plugin.available_version || plugin.version}</span>
            </h3>
            <p>
              {plugin.available_release_notes ||
                t("No release notes are available for this version.")}
            </p>
          </div>
          {plugin.last_error && (
            <div className="react-inline-error">
              <CircleAlert aria-hidden="true" />
              {plugin.last_error}
            </div>
          )}
          <div className="plugin-detail-permissions">
            <h3>{t("Permissions")}</h3>
            {permissions.length ? (
              <ul className="plugin-permissions">
                {permissions.map((permission) => (
                  <li key={permission}>
                    <CheckCircle2 aria-hidden="true" />
                    <span className="plugin-permission-copy">
                      <strong>
                        {permissionDetails[permission]
                          ? t(permissionDetails[permission].title)
                          : permission}
                      </strong>
                      <small>
                        {permissionDetails[permission]
                          ? t(permissionDetails[permission].description)
                          : t("No explanation is available for this permission.")}
                      </small>
                      <code>{permission}</code>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="react-muted">
                {t("This extension does not request any special permissions.")}
              </p>
            )}
          </div>
        </CollapsibleSection>
      </div>
      <div
        id="plugin-detail-panel-settings"
        className="plugin-detail-tab-panel"
        role="tabpanel"
        aria-label={t("Extension settings")}
        aria-labelledby="plugin-detail-tab-settings"
        hidden={activeTab !== "settings"}
        tabIndex={0}
      >
        {settingsPanels.length > 0 ? (
          settingsPanels.map((panel) => (
            <div key={panel.id} className="plugin-detail-settings-panel">
              <ExtensionComponent descriptor={panel} />
            </div>
          ))
        ) : (
          <p className="react-muted">{t("This extension does not provide a settings panel.")}</p>
        )}
      </div>
    </AdminShell>
  )
}
