import { Textarea } from "@/components/ui/textarea"
import { useEffect, useState, type FormEvent } from "react"
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
  const [revision, setRevision] = useState(0)
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
    fetch(`/api/admin/settings/${section}`, {
      credentials: "include",
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error?.message ?? "Грешка при зареждане.")
        if (!abort.signal.aborted) {
          setValues(body.settings)
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
      if (section === "admin") applyAdminSettings(body.settings)
      saved?.()
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
                    hint: "Прилага се при записване и при следващо влизане в панела.",
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
    <form onSubmit={(event) => void save(event)}>
      <CollapsibleSection
        title={details.title}
        icon={details.icon}
        storageKey={`settings:${section}`}
      >
        {failure && (
          <div className="react-error-text" role="alert">
            {failure}
            {!values && (
              <LoadingButton onClick={() => setRevision((value) => value + 1)}>
                Опитай отново
              </LoadingButton>
            )}
          </div>
        )}
        {!values && !failure && <p role="status">Зареждане…</p>}
        {values && (
          <div className="react-form-grid">
            {selects.map(({ key, label, choices, hint }) => (
              <div className="react-form-field settings-field-wide" key={key}>
                <span>{label}</span>
                <DropdownMenu
                  ariaLabel={label}
                  triggerClassName="react-form-select"
                  trigger={
                    <>
                      <span>
                        {(choices as Record<string, string>)[values[key]] ?? "Недостъпна страница"}
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
                      {label}
                    </DropdownOption>
                  ))}
                </DropdownMenu>
                <small>{hint}</small>
              </div>
            ))}
            {section === "public" ? (
              <label className="react-form-field settings-field-wide">
                <span>Съобщение при затворен сайт</span>
                <Textarea
                  rows={3}
                  required
                  maxLength={1000}
                  disabled={saving}
                  value={values.closed_message}
                  onChange={(event) => update("closed_message", event.target.value)}
                />
                <small>До 1000 символа. Показва се като текст, без HTML.</small>
              </label>
            ) : section === "users" ? (
              <>
                <label className="react-form-field">
                  <span>Минимална дължина на паролата</span>
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
                    12–64 символа. При създаване, промяна и възстановяване на парола. Максимумът
                    остава 72 байта.
                  </small>
                </label>
                <label className="react-form-field">
                  <span>Сесия без активност (минути)</span>
                  <input
                    type="number"
                    required
                    min={5}
                    max={1440}
                    disabled={saving}
                    value={values.session_idle_minutes}
                    onChange={(event) => update("session_idle_minutes", event.target.value)}
                  />
                  <small>5–1440 минути. След изтичане е необходимо повторно влизане.</small>
                </label>
              </>
            ) : section === "media" ? (
              <>
                <label className="react-form-field">
                  <span>Максимален размер на файл (MB)</span>
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
                    1–1024 MB. Реалният лимит се ограничава и от PHP конфигурацията на сървъра.
                  </small>
                </label>
                <label className="react-form-field">
                  <span>Максимална резолюция на изображение (мегапиксели)</span>
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
                    1–100 мегапиксела. Например 6000 × 4000 px са 24 мегапиксела. При недостатъчна
                    памет за миниатюра се запазва оригиналът без миниатюра.
                  </small>
                </label>
                <label className="react-form-field">
                  <span>Максимална страна на миниатюрата (px)</span>
                  <input
                    type="number"
                    required
                    min={100}
                    max={1200}
                    disabled={saving || values.generate_thumbnails === "0"}
                    value={values.thumbnail_edge}
                    onChange={(event) => update("thumbnail_edge", event.target.value)}
                  />
                  <small>100–1200 px. Запазва пропорциите и не увеличава малки изображения.</small>
                </label>
              </>
            ) : section === "updates" ? (
              <label className="react-form-field settings-field-wide">
                <span>Изчакване на каталога (секунди)</span>
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
                  5–30 секунди за заявка към каталога на платформата и разширенията. Проверките на
                  подписите и съвместимостта остават задължителни.
                </small>
              </label>
            ) : section === "maintenance" ? (
              <>
                {diagnostics &&
                  Object.entries(diagnostics).map(([label, value]) => (
                    <div className="react-form-field" key={label}>
                      <span>{label}</span>
                      <small>{value}</small>
                    </div>
                  ))}
              </>
            ) : section === "mail" ? (
              <>
                {mail && (
                  <div className="react-form-field settings-field-wide">
                    <span>Връзка за изпращане: {mail.transport}</span>
                    <small>
                      Транспортът, SMTP сървърът и данните за достъп се управляват чрез MAILER_DSN в
                      .env. Текущ подател: {mail.from_name} &lt;{mail.from_address}&gt;.
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
                    <span>{label}</span>
                    <input
                      type={type}
                      maxLength={max}
                      disabled={saving}
                      value={values[key]}
                      onChange={(event) => update(key, event.target.value)}
                    />
                    <small>{hint}</small>
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
            Провери отново
          </LoadingButton>
        </div>
      )}
      {values && section !== "maintenance" && (
        <div className="react-form-actions">
          <LoadingButton
            type="submit"
            loading={saving}
            disabled={saving}
            icon={<Save aria-hidden="true" />}
            className="settings-save-button"
          >
            Запази настройките
          </LoadingButton>
        </div>
      )}
    </form>
  )
}
