import { useEffect, useState } from "react"
import { Info, Palette, ListTree, History, Eye, Power, Download, Upload } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"

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
}: {
  id: string
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
  onBack: () => void
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
  const fields = theme
    ? [
        ["Идентификатор", theme.id],
        ["Автор", theme.author],
        ["Лиценз", theme.license],
        ["Инсталирана версия", theme.installed_version],
        ["Последна съвместима версия", theme.latest_version],
        ["Минимална версия на платформата", theme.minimum_platform_version],
        ["Текуща платформа", theme.platform_version],
        ["PHP", theme.php_version],
        ["Канал", theme.channel],
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
      title={theme?.name ?? "Детайли за темата"}
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
        <LoadingButton onClick={onBack}>Назад към темите</LoadingButton>
      </div>
      {error && (
        <p className="react-error-text" role="alert">
          {error}{" "}
          <LoadingButton onClick={() => setRevision((value) => value + 1)}>
            Опитай отново
          </LoadingButton>
        </p>
      )}
      {!theme && !error && <p role="status">Зареждане…</p>}
      {theme && (
        <div className="theme-detail-sections">
          {theme.catalog_error && <p role="status">{theme.catalog_error}</p>}
          {theme.error && <p className="react-error-text">{theme.error}</p>}
          <CollapsibleSection
            title="Преглед и статус"
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
                  ? "Активна"
                  : theme.installed
                    ? "Инсталирана — неактивна"
                    : "Неинсталирана"}
              </span>
            </p>
            <p>{theme.description || "Няма публикувано описание."}</p>
            <div className="theme-card-actions">
              {!theme.installed && (
                <LoadingButton
                  loading={busy}
                  disabled={busy || !theme.latest_version}
                  onClick={() => void action("install_remote")}
                >
                  <Download />
                  Инсталирай
                </LoadingButton>
              )}
              {theme.installed && theme.valid && (
                <LoadingButton
                  loading={busy}
                  disabled={busy}
                  onClick={() => void action(theme.active ? "deactivate" : "activate")}
                >
                  <Power />
                  {theme.active ? "Деактивирай" : "Активирай"}
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
                  Преглед
                </LoadingButton>
              )}
              {theme.update_available && (
                <LoadingButton
                  loading={busy}
                  disabled={busy}
                  onClick={() => void action("update_remote")}
                >
                  <Upload />
                  Обнови до {theme.latest_version}
                </LoadingButton>
              )}
            </div>
            {!theme.latest_version && !theme.catalog_error && (
              <p>Няма съвместим релийз за текущата платформа и канал.</p>
            )}
          </CollapsibleSection>
          <CollapsibleSection
            title="Основна информация"
            icon={Info}
            storageKey={`theme:${id}:info`}
          >
            <dl className="theme-detail-info">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Не е зададено"}</dd>
                </div>
              ))}
            </dl>
            <p>Тагове: {theme.tags.length ? theme.tags.join(", ") : "Не са зададени"}</p>
            {safeUrl(theme.homepage) && (
              <p>
                <a href={theme.homepage!} target="_blank" rel="noopener noreferrer">
                  Сайт на автора
                </a>
              </p>
            )}
            {safeUrl(theme.documentation) && (
              <p>
                <a href={theme.documentation!} target="_blank" rel="noopener noreferrer">
                  Документация
                </a>
              </p>
            )}
          </CollapsibleSection>
          <CollapsibleSection
            title="Възможности и менюта"
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
                            menus: "Управление на менюта",
                            navigation: "Навигация",
                            featured_image: "Изображения на страници",
                            custom_logo: "Персонализирано лого",
                          })[name] ?? name,
                      )
                      .join(", ")
                  : "Няма декларирани възможности."
                : "Възможностите не са публикувани в каталога."}
            </p>
            <dl className="theme-detail-info">
              {Object.entries(theme.menu_locations ?? {}).map(([location, label]) => (
                <div key={location}>
                  <dt>{label}</dt>
                  <dd>{location}</dd>
                </div>
              ))}
            </dl>
            {!Object.keys(theme.menu_locations ?? {}).length && (
              <p>Няма публикувани локации за менюта.</p>
            )}
            {theme.active && supports?.includes("menus") && (
              <LoadingButton onClick={() => onNavigate("Менюта")}>
                Управление на менюта
              </LoadingButton>
            )}
          </CollapsibleSection>
          <CollapsibleSection
            title="Версии и промени"
            icon={History}
            storageKey={`theme:${id}:releases`}
          >
            {!theme.releases.length && <p>Няма налична информация за релийзите.</p>}
            {theme.releases.map((release) => (
              <CollapsibleSection
                key={`${release.version}:${release.channel}`}
                title={`${release.version} · ${release.channel}`}
                storageKey={`theme:${id}:${release.version}:${release.channel}`}
                defaultOpen={false}
              >
                <p>
                  {release.compatible
                    ? "Съвместима с текущата платформа"
                    : release.reasons.join(" ")}
                </p>
                <p className="theme-detail-notes">
                  {release.release_notes || "Няма описание на промените."}
                </p>
                <dl className="theme-detail-info">
                  <div>
                    <dt>Публикувана</dt>
                    <dd>{new Date(release.published_at).toLocaleString("bg-BG")}</dd>
                  </div>
                  <div>
                    <dt>Размер</dt>
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
                    <dt>Подпис</dt>
                    <dd>
                      {release.signed
                        ? `${release.signature_algorithm ?? "Подписан"} · ${release.key_id ?? "Без идентификатор"} (проверява се при инсталиране)`
                        : "Не е подписан"}
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
