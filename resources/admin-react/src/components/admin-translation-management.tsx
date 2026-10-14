import { useState } from "react"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { CodeEditor } from "@/components/code-editor"
import { LoadingButton } from "@/components/loading-button"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { useWorkspaceSaved } from "@/components/admin-workspace-context"
import { getCsrfToken } from "@/lib/admin-api"
import {
  getAdminLocale,
  getAdminLocales,
  getAdminTranslationCatalog,
  getAdminTranslationOverrides,
  getPackagedAdminTranslationCatalog,
  setAdminTranslationOverrides,
  t,
  useAdminLocale,
  type AdminTranslationOverrides,
} from "@/lib/admin-i18n"

function catalogJson(locale: string): string {
  return JSON.stringify(getAdminTranslationCatalog(locale), null, 2)
}

export function AdminTranslationManagement() {
  const activePanelLocale = useAdminLocale()
  const locales = getAdminLocales()
  const markSaved = useWorkspaceSaved()
  const [selectedLocale, setSelectedLocale] = useState(() => getAdminLocale())
  const [initialDraft] = useState(() => catalogJson(getAdminLocale()))
  const [draft, setDraft] = useState(initialDraft)
  const [baseline, setBaseline] = useState(initialDraft)
  const [saving, setSaving] = useState(false)

  async function saveTranslations() {
    if (saving) return
    let catalog: unknown
    try {
      catalog = JSON.parse(draft)
    } catch {
      toast.error(t("Translation JSON is invalid."))
      return
    }
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
      toast.error(t("The catalog must be a JSON object grouped by namespace."))
      return
    }

    const packagedCatalog = getPackagedAdminTranslationCatalog(selectedLocale).core ?? {}
    const overrides: Record<string, Record<string, string>> = {}
    for (const [namespace, entries] of Object.entries(catalog)) {
      if (namespace !== "core") {
        toast.error(t("Platform translation files can contain only the core namespace."))
        return
      }
      if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
        toast.error(t("Each namespace must contain a JSON object of translations."))
        return
      }
      const translatedEntries: Record<string, string> = {}
      for (const [source, translated] of Object.entries(entries)) {
        if (typeof translated !== "string") {
          toast.error(t("Every translation value must be a string."))
          return
        }
        if (translated !== packagedCatalog[source]) translatedEntries[source] = translated
      }
      if (Object.keys(translatedEntries).length > 0) overrides[namespace] = translatedEntries
    }
    const previousOverrides = getAdminTranslationOverrides()[selectedLocale]?.core ?? {}
    const hasPreviousOverrides = Object.keys(previousOverrides).length > 0
    const hasDraftOverrides = Object.keys(overrides).length > 0
    if (
      hasPreviousOverrides &&
      !hasDraftOverrides &&
      !window.confirm(t("Clear all saved overrides for this language?"))
    ) return

    setSaving(true)
    try {
      const csrfToken = await getCsrfToken()
      const response = await fetch("/api/admin/translations", {
        method: "PUT",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ locale: selectedLocale, catalog: overrides }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        overrides?: AdminTranslationOverrides
        error?: { message?: string }
      }
      if (!response.ok || !body.overrides)
        throw new Error(t(body.error?.message ?? "Could not save translations."))

      setAdminTranslationOverrides(body.overrides)
      const savedDraft = catalogJson(selectedLocale)
      setDraft(savedDraft)
      setBaseline(savedDraft)
      markSaved?.()
      toast.success(t("Translations saved."))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Could not save translations."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-translation-management">
      <div className="admin-translation-toolbar">
        <DropdownMenu
          ariaLabel={t("Choose translation language")}
          triggerClassName="react-form-select"
          trigger={
            <>
              <span>
                {locales.find((item) => item.code === selectedLocale)?.label ??
                  (selectedLocale === activePanelLocale ? activePanelLocale : selectedLocale)}
              </span>
              <DropdownChevron />
            </>
          }
        >
          {locales.map((item) => (
            <DropdownOption
              key={item.code}
              selected={selectedLocale === item.code}
              onClick={() => {
                if (
                  draft !== baseline &&
                  !window.confirm(t("Discard unsaved translation edits?"))
                ) return
                setSelectedLocale(item.code)
                const nextDraft = catalogJson(item.code)
                setDraft(nextDraft)
                setBaseline(nextDraft)
              }}
            >
              {item.label}
            </DropdownOption>
          ))}
        </DropdownMenu>
        <LoadingButton
          icon={<Save aria-hidden="true" />}
          loading={saving}
          disabled={draft === baseline}
          type="button"
          onClick={() => void saveTranslations()}
        >
          {t("Save translations")}
        </LoadingButton>
      </div>
      <p className="admin-translation-help">
        {t("Edit translation values in JSON. English source text is used as each key.")}
      </p>
      <CodeEditor
        value={draft}
        onChange={setDraft}
        readOnly={false}
        language="json"
        height="560px"
        copyLabel={t("Copy translations")}
      />
    </div>
  )
}
