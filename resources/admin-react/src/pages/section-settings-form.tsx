import { t } from "@/lib/admin-i18n"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  Globe,
  UsersRound,
  Images,
  Mail,
  Save,
  RefreshCw,
  PanelsTopLeft,
  Wrench,
} from "lucide-react"
import { applyAdminSettings } from "@/lib/admin-theme"
import { toast } from "sonner"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownMenu, DropdownOption, DropdownChevron } from "@/components/dropdown-menu"
import { LoadingButton } from "@/components/loading-button"
import { getCsrfToken } from "@/lib/admin-api"
import { useWorkspaceChanged, useWorkspaceSaved } from "@/components/admin-workspace-context"
import { ExtensionScope, usePanelSaves } from "@/components/extension-page"
import { OperationErrorsLog } from "@/components/operation-errors-log"
import { useFormDirty } from "@/lib/use-form-dirty"

export function SectionSettingsForm({
  section,
}: {
  section: "public" | "users" | "media" | "mail" | "updates" | "admin" | "maintenance"
}) {
  const [values, setValues] = useState<Record<string, string> | null>(null)
  const [pages, setPages] = useState<Array<{ id: number; title: string }>>([])
  const [mail, setMail] = useState<{
    transport: string
    from_address: string
    from_name: string
  } | null>(null)
  const [failure, setFailure] = useState("")
  const [diagnostics, setDiagnostics] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)
  // Plugins add sections and fields here through extension points; they save right after this record.
  const saves = usePanelSaves()
  const extensionScope = useMemo(
    () => ({ context: { type: "settings", id: section, values }, saves }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, values],
  )
  const [revision, setRevision] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const { isDirty, markClean, refresh } = useFormDirty(formRef, values !== null)
  const changed = useWorkspaceChanged()
  const saved = useWorkspaceSaved()
  const details = {
    public: { title: "Публична част", icon: Globe },
    users: { title: "Потребители и достъп", icon: UsersRound },
    media: { title: "Медийна библиотека", icon: Images },
    mail: { title: "Имейли", icon: Mail },
    updates: { title: "Обновявания", icon: RefreshCw },
    admin: { title: "Административен панел", icon: PanelsTopLeft },
    maintenance: { title: "Поддръжка и диагностика", icon: Wrench },
  }[section]
  useEffect(() => {
    const abort = new AbortController()
    setFailure("")
    setValues(null)
    setDiagnostics(null)
    fetch(`/api/admin/settings/${section}`, {
      credentials: "include",
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error?.message ?? "Грешка при зареждане.")
        if (!abort.signal.aborted) {
          const settings = body.settings
          setValues(
            settings && typeof settings === "object" && !Array.isArray(settings)
              ? settings
              : {},
          )
          setPages(body.pages)
          setMail(body.mail ?? null)
          setDiagnostics(body.diagnostics ?? null)
        }
      })
      .catch((error) => {
        if (!abort.signal.aborted) setFailure(error.message)
      })
    return () => abort.abort()
  }, [section, revision])
  function update(key: string, value: string) {
    setValues((current) => (current ? { ...current, [key]: value } : current))
    changed?.()
    refresh()
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (saving || !values) return
    setSaving(true)
    setFailure("")
    try {
      const token = await getCsrfToken()
      const response = await fetch(`/api/admin/settings/${section}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: JSON.stringify(values),
        signal: AbortSignal.timeout(20000),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message ?? "Грешка при записване.")
      setValues(body.settings)
      setMail(body.mail ?? null)
      markClean()
      if (section === "admin") applyAdminSettings(body.settings)
      saved?.()
      await saves.run({ id: section })
      toast.success("Настройките са запазени.")
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Грешка при записване.")
    } finally {
      setSaving(false)
    }
  }
  const selects: Array<{
    key: string
    label: string
    choices: Record<string, string>
    hint: string
  }> =
    section === "public"
      ? [
          {
            key: "home_page_id",
            label: "Начална страница",
            choices: {
              "0": "По подразбиране (конфигурация)",
              ...Object.fromEntries(pages.map((page) => [String(page.id), page.title])),
            },
            hint: "Изберете публикувана страница за началната страница на сайта.",
          },
          {
            key: "closed",
            label: "Достъп до сайта",
            choices: { "0": "Отворен", "1": "Временно затворен" },
            hint: "При затваряне посетителите виждат съобщението по-долу. Панелът остава достъпен.",
          },
        ]
      : section === "users"
        ? [
            {
              key: "default_role",
              label: "Роля по подразбиране",
              choices: { user: "Потребител", editor: "Редактор", admin: "Администратор" },
              hint: "За нови потребители. Съществуващите роли остават непроменени.",
            },
            {
              key: "require_email_verification",
              label: "Потвърждение на имейл",
              choices: { "0": "По избор при създаване", "1": "Задължително" },
              hint: "За нови потребители. При задължително потвърждение се изпраща имейл независимо от избора във формата.",
            },
          ]
        : section === "media"
          ? [
              ...[
                ["allow_images", "Изображения", "JPEG, PNG, WebP и GIF."],
                ["allow_documents", "Документи", "PDF файлове."],
                ["allow_audio", "Аудио", "MP3, OGG и WAV."],
                ["allow_video", "Видео", "MP4 и WebM."],
                [
                  "generate_thumbnails",
                  "Генериране на миниатюри",
                  "При ново качване на изображения. Съществуващите файлове остават непроменени.",
                ],
              ].map(([key, label, hint]) => ({
                key,
                label,
                hint,
                choices: { "1": "Разрешено", "0": "Изключено" },
              })),
            ]
          : section === "updates"
            ? [
                {
                  key: "channel",
                  label: "Канал за обновяване на ядрото",
                  choices: { stable: "Стабилен", beta: "Бета", dev: "Разработка" },
                  hint: "Определя кои релийзи на платформата се показват и могат да се инсталират. Обновяването се стартира ръчно от раздел Обновявания.",
                },
              ]
            : section === "admin"
              ? [
                  {
                    key: "theme",
                    label: "Цветова тема на панела",
                    choices: { system: "Според устройството", light: "Светла", dark: "Тъмна" },
                    hint: "Тема по подразбиране за всички администратори. Потребител, избрал тема в профила си, вижда своя избор.",
                  },
                  {
                    key: "remember_tabs",
                    label: "Запомняне на отворените табове",
                    choices: { "1": "Включено", "0": "Изключено" },
                    hint: "Запазва локално само адресите на табовете, по потребител и инсталация. Данните във формите не се записват. При изключване табовете остават отворени до презареждане.",
                  },
                ]
              : []
  return (
    <ExtensionScope value={extensionScope}>
      <form ref={formRef} onClickCapture={refresh} onSubmit={(event) => void save(event)}>
        <input type="hidden" value={JSON.stringify({ values, mail })} />
        <CollapsibleSection
          extensionPoint={`settings.${section}`}
          title={t(details.title)}
          icon={details.icon}
          storageKey={`settings:${section}`}
        >
          {failure && (
            <div className="react-error-text" role="alert">
              {failure}
              {!values && (
                <LoadingButton onClick={() => setRevision((value) => value + 1)}>

                  {t("Try again")}
                </LoadingButton>
              )}
            </div>
          )}
          {!values && !failure && <p role="status">{t("Loading…")}</p>}
          {values && (
            <div className="react-form-grid">
              {selects.map(({ key, label, choices, hint }) => (
                <div className="react-form-field settings-field-wide" key={key}>
                  <span>{t(label)}</span>
                  <DropdownMenu
                    ariaLabel={t(label)}
                    triggerClassName="react-form-select"
                    trigger={
                      <>
                        <span>
                          {(section === "public" && key === "home_page_id" && values[key] !== "0"
                            ? (choices as Record<string, string>)[values[key]]
                            : t((choices as Record<string, string>)[values[key]] ?? "Unavailable page"))}
                        </span>
                        <DropdownChevron />
                      </>
                    }
                  >
                    {Object.entries(choices).map(([value, label]) => (
                      <DropdownOption
                        key={value}
                        selected={values[key] === value}
                        disabled={saving}
                        onClick={() => update(key, value)}
                      >
                        {section === "public" && key === "home_page_id" && value !== "0"
                          ? label
                          : t(label)}
                      </DropdownOption>
                    ))}
                  </DropdownMenu>
                  <small>{t(hint)}</small>
                </div>
              ))}
              {section === "public" ? (
                <label className="react-form-field settings-field-wide">
                  <span>{t("Site closed message")}</span>
                  <Textarea
                    rows={3}
                    required
                    maxLength={1000}
                    disabled={saving}
                    value={values.closed_message}
                    onChange={(event) => update("closed_message", event.target.value)}
                  />
                  <small>{t("Up to 1,000 characters. Displayed as plain text without HTML.")}</small>
                </label>
              ) : section === "users" ? (
                <>
                  <label className="react-form-field">
                    <span>{t("Minimum password length")}</span>
                    <input
                      type="number"
                      required
                      min={12}
                      max={64}
                      disabled={saving}
                      value={values.password_min_length}
                      onChange={(event) => update("password_min_length", event.target.value)}
                    />
                    <small>

                      {t("12–64 characters when creating, changing, or recovering a password. The 72-byte maximum still applies.")}
                    </small>
                  </label>
                  <label className="react-form-field">
                    <span>{t("Idle session timeout (minutes)")}</span>
                    <input
                      type="number"
                      required
                      min={5}
                      max={1440}
                      disabled={saving}
                      value={values.session_idle_minutes}
                      onChange={(event) => update("session_idle_minutes", event.target.value)}
                    />
                    <small>{t("5–1,440 minutes. Sign-in is required again after the timeout.")}</small>
                  </label>
                </>
              ) : section === "media" ? (
                <>
                  <label className="react-form-field">
                    <span>{t("Maximum file size (MB)")}</span>
                    <input
                      type="number"
                      required
                      min={1}
                      max={1024}
                      disabled={saving}
                      value={values.max_upload_mb}
                      onChange={(event) => update("max_upload_mb", event.target.value)}
                    />
                    <small>

                      {t("1–1,024 MB. The PHP server configuration may impose a lower limit.")}
                    </small>
                  </label>
                  <label className="react-form-field">
                    <span>{t("Maximum image resolution (megapixels)")}</span>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      step={1}
                      disabled={saving}
                      value={values.max_image_megapixels}
                      onChange={(event) => update("max_image_megapixels", event.target.value)}
                    />
                    <small>

                      {t("1–100 megapixels. For example, 6000 × 4000 px is 24 megapixels. If there is not enough memory to create a thumbnail, the original is kept without one.")}
                    </small>
                  </label>
                  <label className="react-form-field">
                    <span>{t("Maximum thumbnail side (px)")}</span>
                    <input
                      type="number"
                      required
                      min={100}
                      max={1200}
                      disabled={saving || values.generate_thumbnails === "0"}
                      value={values.thumbnail_edge}
                      onChange={(event) => update("thumbnail_edge", event.target.value)}
                    />
                    <small>

                      {t("100–1,200 px. Keeps proportions and does not enlarge small images.")}
                    </small>
                  </label>
                </>
              ) : section === "updates" ? (
                <label className="react-form-field settings-field-wide">
                  <span>{t("Catalog request timeout (seconds)")}</span>
                  <input
                    type="number"
                    required
                    min={5}
                    max={30}
                    value={values.catalog_timeout}
                    disabled={saving}
                    onChange={(event) => update("catalog_timeout", event.target.value)}
                  />
                  <small>

                    {t("5–30 seconds for platform and extension catalog requests. Signature and compatibility checks remain required.")}
                  </small>
                </label>
              ) : section === "maintenance" ? (
                <>
                  <div className="react-form-field settings-field-wide operation-errors-log-field">
                    <span>{t("Operation error log")}</span>
                    <small>

                      {t("Append-only JSON Lines file on disk. Each platform, plugin, or theme error is added as a new line.")}
                    </small>
                    <OperationErrorsLog revision={revision} />
                  </div>
                  {diagnostics &&
                    Object.entries(diagnostics).map(([label, value]) => (
                      <div className="react-form-field" key={label}>
                        <span>{t(label)}</span>
                        <small>{value}</small>
                      </div>
                    ))}
                </>
              ) : section === "mail" ? (
                <>
                  {mail && (
                    <div className="react-form-field settings-field-wide">
                      <span>{t("Send connection:")} {mail.transport}</span>
                      <small>

                        {t("Transport, SMTP server, and credentials are configured through MAILER_DSN in .env. Current sender:")} {mail.from_name} &lt;{mail.from_address}&gt;.
                      </small>
                    </div>
                  )}
                  {[
                    {
                      key: "from_name",
                      label: "Име на подателя",
                      type: "text",
                      max: 150,
                      hint: "По желание. Празно поле използва MAIL_FROM_NAME от .env.",
                    },
                    {
                      key: "from_address",
                      label: "Имейл на подателя",
                      type: "email",
                      max: 190,
                      hint: "По желание. Празно поле използва MAIL_FROM_ADDRESS от .env. Адресът трябва да е разрешен от вашия SMTP доставчик.",
                    },
                    {
                      key: "reply_to",
                      label: "Адрес за отговор",
                      type: "email",
                      max: 190,
                      hint: "По желание. При празно поле отговорите се връщат към подателя, освен ако разширение е задало собствен адрес за отговор.",
                    },
                  ].map(({ key, label, type, max, hint }) => (
                    <label className="react-form-field settings-field-wide" key={key}>
                      <span>{t(label)}</span>
                      <input
                        type={type}
                        maxLength={max}
                        disabled={saving}
                        value={values[key]}
                        onChange={(event) => update(key, event.target.value)}
                      />
                      <small>{t(hint)}</small>
                    </label>
                  ))}
                </>
              ) : null}
            </div>
          )}
        </CollapsibleSection>
        {values && section === "maintenance" && (
          <div className="react-form-actions">
            <LoadingButton
              onClick={() => {
                setValues(null)
                setRevision((value) => value + 1)
              }}
            >
              <RefreshCw />

              {t("Check again")}
            </LoadingButton>
          </div>
        )}
        {values && section !== "maintenance" && (
          <div className="react-form-actions">
            <LoadingButton
              type="submit"
              loading={saving}
              disabled={saving || !isDirty}
              icon={<Save aria-hidden="true" />}
              className="settings-save-button"
            >

              {t("Save settings")}
            </LoadingButton>
          </div>
        )}
      </form>
    </ExtensionScope>
  )
}
