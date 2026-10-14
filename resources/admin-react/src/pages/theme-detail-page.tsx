import { t } from "@/lib/admin-i18n"
import { useEffect, useState } from "react"
import { Info, Palette, ListTree, History, Eye, Power, Download, Upload, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import { DateTime } from "@/components/date-time"

type Release = {
  version: string
  channel: string
  published_at: string
  release_notes: string
  size: number
  minimum_php: string
  compatible_from: string
  signed: boolean
  signature_algorithm: string | null
  key_id: string | null
  compatible: boolean
  reasons: string[]
}
type Detail = {
  id: string
  name: string | null
  description: string | null
  author: string | null
  license: string | null
  homepage: string | null
  documentation: string | null
  minimum_platform_version: string | null
  installed: boolean
  active: boolean
  valid: boolean
  error: string | null
  installed_version: string | null
  latest_version: string | null
  update_available: boolean
  screenshot_url: string | null
  tags: string[]
  supports: Record<string, boolean> | string[] | null
  menu_locations: Record<string, string> | null
  platform_version: string
  php_version: string
  channel: string
  releases: Release[]
  catalog_error: string | null
}
const safeUrl = (value: string | null) => (value && /^https?:\/\//i.test(value) ? value : null)

export function ThemeDetailPage({
  id,
  onLogout,
  onNavigate,
  loggingOut,
  onBack,
  onSettings,
}: {
  id: string
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
  onBack: () => void
  onSettings: () => void
}) {
  const [theme, setTheme] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetch(`/api/admin/themes/${encodeURIComponent(id)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok)
          throw new Error(body.error?.message ?? "Детайлите не можаха да бъдат заредени.")
        if (!controller.signal.aborted) setTheme(body.theme)
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Грешка при зареждане.")
      })
    return () => controller.abort()
  }, [id, revision])
  async function action(action: string) {
    if (busy) return
    setBusy(true)
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/themes/action", {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({ id, action }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message ?? "Действието не беше изпълнено.")
      window.dispatchEvent(new Event("flex-admin-theme-changed"))
      setRevision((value) => value + 1)
      toast.success("Темата е актуализирана.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Грешка.")
    } finally {
      setBusy(false)
    }
  }
  const fields: [string, string | null][] = theme
    ? [
        ["Идентификатор", theme.id],
        ["Автор", theme.author],
        ["Лиценз", theme.license],
        ["Инсталирана версия", theme.installed_version],
        ["Последна съвместима версия", theme.latest_version],
        ["Минимална версия на платформата", theme.minimum_platform_version],
        ["Текуща платформа", theme.platform_version],
        ["PHP", theme.php_version],
        ["Channel", theme.channel],
      ]
    : []
  const supports = theme?.supports
    ? Array.isArray(theme.supports)
      ? theme.supports
      : Object.entries(theme.supports)
          .filter(([, enabled]) => enabled)
          .map(([name]) => name)
    : null
  return (
    <AdminShell
      title={theme?.name ?? t("Theme details")}
      activeItem="Теми"
      onLogout={onLogout}
      onNavigate={onNavigate}
      loggingOut={loggingOut}
    >
      <div className="react-page-heading">
        <div>
          <h1>{theme?.name ?? id}</h1>
          <Breadcrumbs
            onHomeClick={() => onNavigate("Табло")}
            items={[{ label: "Теми", onClick: onBack }, { label: theme?.name ?? id }]}
          />
        </div>
        <div className="react-page-heading-actions">
          {theme?.active && (
            <LoadingButton onClick={onSettings}>
              <Settings2 aria-hidden="true" />

              {t("Theme settings")}
            </LoadingButton>
          )}
          <LoadingButton onClick={onBack}>{t("Back to themes")}</LoadingButton>
        </div>
      </div>
      {error && (
        <p className="react-error-text" role="alert">
          {error}{" "}
          <LoadingButton onClick={() => setRevision((value) => value + 1)}>

            {t("Try again")}
          </LoadingButton>
        </p>
      )}
      {!theme && !error && <p role="status">{t("Loading…")}</p>}
      {theme && (
        <div className="theme-detail-sections">
          {theme.catalog_error && <p role="status">{theme.catalog_error}</p>}
          {theme.error && <p className="react-error-text">{theme.error}</p>}
          <CollapsibleSection
            extensionPoint="theme.detail.overview"
            title={t("Overview and status")}
            className="theme-detail-overview"
            icon={Palette}
            storageKey={`theme:${id}:overview`}
          >
            {(safeUrl(theme.screenshot_url) ||
              theme.screenshot_url?.startsWith("/theme-assets/")) && (
              <img
                className="theme-detail-preview"
                src={theme.screenshot_url!}
                alt={`Преглед на ${theme.name ?? id}`}
              />
            )}
            <p>
              <span
                className={`react-status-badge ${theme.active ? "status-active" : theme.installed ? "status-installed" : "status-inactive"}`}
              >
                {theme.active
                  ? t("Active (feminine)")
                  : theme.installed
                    ? t("Installed but inactive")
                    : t("Not installed")}
              </span>
            </p>
            <p>{theme.description || t("No published description.")}</p>
            <div className="theme-card-actions">
              {!theme.installed && (
                <LoadingButton
                  loading={busy}
                  disabled={busy || !theme.latest_version}
                  onClick={() => void action("install_remote")}
                >
                  <Download />

                  {t("Install")}
                </LoadingButton>
              )}
              {theme.installed && theme.valid && (
                <LoadingButton
                  loading={busy}
                  disabled={busy}
                  onClick={() => void action(theme.active ? "deactivate" : "activate")}
                >
                  <Power />
                  {theme.active ? t("Deactivate") : t("Activate")}
                </LoadingButton>
              )}
              {theme.installed && theme.valid && (
                <LoadingButton
                  onClick={() =>
                    window.open(
                      `/admin/themes/${encodeURIComponent(id)}/preview`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <Eye />

                  {t("Preview")}
                </LoadingButton>
              )}
              {theme.update_available && (
                <LoadingButton
                  loading={busy}
                  disabled={busy}
                  onClick={() => void action("update_remote")}
                >
                  <Upload />

                  {t("Upgrade to")} {theme.latest_version}
                </LoadingButton>
              )}
            </div>
            {!theme.latest_version && !theme.catalog_error && (
              <p>{t("No compatible release is available for this platform and channel.")}</p>
            )}
          </CollapsibleSection>
          <CollapsibleSection
            extensionPoint="theme.detail.information"
            title={t("Basic information")}
            icon={Info}
            storageKey={`theme:${id}:info`}
          >
            <dl className="theme-detail-info">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{t(label)}</dt>
                  <dd>{value || t("Not set")}</dd>
                </div>
              ))}
            </dl>
            <p>{t("Tags:")} {theme.tags.length ? theme.tags.join(", ") : t("Not set (plural)")}</p>
            {safeUrl(theme.homepage) && (
              <p>
                <a href={theme.homepage!} target="_blank" rel="noopener noreferrer">

                  {t("Author website")}
                </a>
              </p>
            )}
            {safeUrl(theme.documentation) && (
              <p>
                <a href={theme.documentation!} target="_blank" rel="noopener noreferrer">

                  {t("Documentation")}
                </a>
              </p>
            )}
          </CollapsibleSection>
          <CollapsibleSection
            extensionPoint="theme.detail.features"
            title={t("Features and menus")}
            icon={ListTree}
            storageKey={`theme:${id}:features`}
          >
            <p>
              {supports
                ? supports.length
                  ? supports
                      .map(
                        (name) =>
                          ({
                            menus: t("Manage menus"),
                            navigation: t("Navigation"),
                            featured_image: t("Page images"),
                            custom_logo: t("Personalized logo"),
                          })[name] ?? name,
                      )
                      .join(", ")
                  : t("No capabilities are declared.")
                : t("Capabilities are not published in the catalog.")}
            </p>
            <dl className="theme-detail-info">
              {Object.entries(theme.menu_locations ?? {}).map(([location, label]) => (
                <div key={location}>
                  <dt>{t(label)}</dt>
                  <dd>{location}</dd>
                </div>
              ))}
            </dl>
            {!Object.keys(theme.menu_locations ?? {}).length && (
              <p>{t("No published menu locations.")}</p>
            )}
            {theme.active && supports?.includes("menus") && (
              <LoadingButton onClick={() => onNavigate("Менюта")}>

                {t("Manage menus")}
              </LoadingButton>
            )}
          </CollapsibleSection>
          <CollapsibleSection
            extensionPoint="theme.detail.releases"
            title={t("Versions and changes")}
            icon={History}
            storageKey={`theme:${id}:releases`}
          >
            {!theme.releases.length && <p>{t("No release information is available.")}</p>}
            {theme.releases.map((release) => (
              <CollapsibleSection
                key={`${release.version}:${release.channel}`}
                title={`${release.version} · ${release.channel}`}
                storageKey={`theme:${id}:${release.version}:${release.channel}`}
                defaultOpen={false}
              >
                <p>
                  {release.compatible
                    ? t("Compatible with the current platform")
                    : release.reasons.join(" ")}
                </p>
                <p className="theme-detail-notes">
                  {release.release_notes || t("No change log is available.")}
                </p>
                <dl className="theme-detail-info">
                  <div>
                    <dt>{t("Published")}</dt>
                    <dd>
                      <DateTime value={release.published_at} />
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Size")}</dt>
                    <dd>{(release.size / 1024).toFixed(1)} KB</dd>
                  </div>
                  <div>
                    <dt>PHP</dt>
                    <dd>{release.minimum_php}</dd>
                  </div>
                  <div>
                    <dt>Flex CMS</dt>
                    <dd>{release.compatible_from}</dd>
                  </div>
                  <div>
                    <dt>{t("Signature")}</dt>
                    <dd>
                      {release.signed
                        ? `${release.signature_algorithm ?? t("Signed")} · ${release.key_id ?? t("No key identifier")} (${t("verified during installation")})`
                        : t("Unsigned")}
                    </dd>
                  </div>
                </dl>
              </CollapsibleSection>
            ))}
          </CollapsibleSection>
        </div>
      )}
    </AdminShell>
  )
}
