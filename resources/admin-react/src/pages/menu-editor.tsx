import { t } from "@/lib/admin-i18n"
import { LoadingButton } from "@/components/loading-button"
import { useEffect, useMemo, useRef, useState } from "react"
import { Save, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownMenu, DropdownOption, DropdownChevron } from "@/components/dropdown-menu"
import { useWorkspaceChanged } from "@/components/admin-workspace-context"
import { menuRequest, type MenuIndex, type MenuRecord, type MenuStatus } from "@/lib/menu-api"
import type { MenuShellProps } from "./menus-page"
import { ExtensionScope, usePanelSaves } from "@/components/extension-page"

const statusLabels: Record<MenuStatus, string> = {
  active: "Активно",
  inactive: "Неактивно",
  draft: "Чернова",
}
const blank = (): MenuRecord => ({
  id: 0,
  name: "",
  slug: "",
  status: "active",
  version: 0,
  items: [],
})
export function MenuEditor({
  id,
  onBack,
  onSaved,
  capabilities,
  error,
  onStructure,
  ...shell
}: MenuShellProps & {
  id: number | null
  onBack: () => void
  onSaved: (menu: MenuRecord) => void
  onStructure: (menuId: number) => void
}) {
  const [menu, setMenu] = useState<MenuRecord>(blank)
  const [index, setIndex] = useState<MenuIndex | null>(null)
  const [location, setLocation] = useState("")
  const initialLocation = useRef("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Plugins add sections and fields here through extension points; they save right after this record.
  const saves = usePanelSaves()
  const extensionScope = useMemo(
    () => ({ context: { type: "menu", id: menu.id ?? null, values: menu }, saves }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menu],
  )
  const [failure, setFailure] = useState("")
  const loadedId = useRef<number | null | undefined>(undefined)
  const changed = useWorkspaceChanged()
  const supported = capabilities?.supports.menus === true
  const themeChanged = !!index && index.theme !== capabilities?.theme
  const occupiedMenu = index?.menus.find(
    (entry) => entry.id === index.assignments[location] && entry.id !== menu.id,
  )
  useEffect(() => {
    if (!supported) {
      setLoading(false)
      return
    }
    if (loadedId.current === id) return
    const abort = new AbortController()
    setLoading(true)
    setFailure("")
    Promise.all([
      menuRequest<MenuIndex>("/api/admin/menus", "GET", undefined, abort.signal),
      id
        ? menuRequest<{ menu: MenuRecord }>(
            `/api/admin/menus/${id}`,
            "GET",
            undefined,
            abort.signal,
          )
        : Promise.resolve({ menu: blank() }),
    ])
      .then(([data, record]) => {
        if (abort.signal.aborted) return
        loadedId.current = id
        setIndex(data)
        setMenu(record.menu)
        const selected =
          Object.keys(data.menu_locations).find(
            (key) => data.assignments[key] === record.menu.id,
          ) ?? ""
        initialLocation.current = selected
        setLocation(selected)
      })
      .catch((error) => {
        if (!abort.signal.aborted) setFailure(error.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [id, supported])
  function update(next: MenuRecord) {
    setMenu(next)
    changed?.()
  }
  function selectLocation(next: string) {
    setLocation(next)
    changed?.()
  }
  async function save() {
    if (!supported || !index || themeChanged || saving || loading) return
    setSaving(true)
    setFailure("")
    try {
      const result = await menuRequest<{ menu: MenuRecord; index?: MenuIndex }>(
        menu.id ? `/api/admin/menus/${menu.id}` : "/api/admin/menus",
        menu.id ? "PUT" : "POST",
        {
          name: menu.name,
          slug: menu.slug,
          status: menu.status,
          version: menu.version,
          ...(!menu.id || location !== initialLocation.current
            ? {
                placement: {
                  theme: index.theme,
                  assignment_version: index.assignment_version,
                  location: location || null,
                },
              }
            : {}),
        },
      )
      setMenu(result.menu)
      if (result.index) setIndex(result.index)
      initialLocation.current = location
      onSaved(result.menu)
      await saves.run({ id: result.menu.id })
      toast.success("Менюто е запазено.")
    } catch (error) {
      setFailure((error as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <AdminShell
      {...shell}
      title={menu.id ? t("Menu: {name}", "core", { name: menu.name }) : t("New menu")}
      activeItem="Менюта"
    >
      <div className="react-page-heading">
        <div>
          <h1>{menu.id ? t("Edit menu") : t("Create menu")}</h1>
          <Breadcrumbs
            onHomeClick={() => shell.onNavigate("Табло")}
            items={[{ label: "Менюта", onClick: onBack }, { label: menu.name || "Ново меню" }]}
          />
        </div>
        {menu.id > 0 && (
          <button type="button" onClick={() => onStructure(menu.id)}>

            {t("Menu structure")}
          </button>
        )}
      </div>
      {(error || failure) && (
        <p className="react-form-error" role="alert">
          {error || failure}
        </p>
      )}
      {themeChanged && (
        <p className="react-form-error" role="alert">

          {t("The active theme has changed. Reload the data to choose its locations.")}
        </p>
      )}
      {!supported ? (
        <p>{t("The active theme does not support menu management. Unsaved changes remain in this tab.")}</p>
      ) : loading ? (
        <p role="status">{t("Loading menu…")}</p>
      ) : (
        <ExtensionScope value={extensionScope}>
          <form
            className="react-page-form"
            id={`menu-form-${id ?? "new"}`}
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <fieldset className="menu-fieldset" disabled={saving || themeChanged}>
              <CollapsibleSection
                extensionPoint="menu.editor.settings"
                title={t("Menu settings")}
                icon={Settings2}
                storageKey="menu-editor-settings"
              >
                <div className="react-form-grid">
                  <label className="react-form-field">
                    <span>{t("Name")}</span>
                    <input
                      value={menu.name}
                      maxLength={120}
                      required
                      onChange={(event) => update({ ...menu, name: event.target.value })}
                    />
                    <small>

                      {t("Enter a descriptive name so you can identify this menu in the panel.")}
                    </small>
                  </label>
                  <label className="react-form-field">
                    <span>{t("Identifier (optional)")}</span>
                    <input
                      value={menu.slug}
                      maxLength={120}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      placeholder={t("Generated from the name")}
                      onChange={(event) => update({ ...menu, slug: event.target.value })}
                    />
                    <small>

                      {t("Leave blank to generate automatically from the name. Use lowercase Latin letters, numbers, and hyphens when entering a value manually.")}
                    </small>
                  </label>
                  <div className="react-form-field">
                    <span>{t("Location")}</span>
                    <DropdownMenu
                      ariaLabel={t("Menu location")}
                      triggerClassName="react-form-select"
                      trigger={
                        <>
                          <span>{t(index?.menu_locations[location] ?? "— No location —")}</span>
                          <DropdownChevron />
                        </>
                      }
                    >
                      <DropdownOption
                        selected={location === ""}
                        disabled={saving || themeChanged}
                        onClick={() => selectLocation("")}
                      >

                        {t("— No location —")}
                      </DropdownOption>
                      {Object.entries(index?.menu_locations ?? {}).map(([key, title]) => (
                        <DropdownOption
                          key={key}
                          selected={location === key}
                          disabled={saving || themeChanged}
                          onClick={() => selectLocation(key)}
                        >
                          {t(title)}
                        </DropdownOption>
                      ))}
                    </DropdownMenu>
                    <small>

                      {t("Choose where the active theme should display this menu. “No location” saves it without displaying it in the theme.")}
                    </small>
                    {occupiedMenu && (
                      <small>

                        {t("This location is used by “")}{occupiedMenu.name}{t("”. Saving will link it to this menu.")}
                      </small>
                    )}
                  </div>
                  <div className="react-form-field">
                    <span>{t("Status")}</span>
                    <DropdownMenu
                      ariaLabel={t("Menu status")}
                      triggerClassName="react-form-select"
                      trigger={
                        <>
                          <span>{t(statusLabels[menu.status])}</span>
                          <DropdownChevron />
                        </>
                      }
                    >
                      {(Object.entries(statusLabels) as [MenuStatus, string][]).map(
                        ([value, title]) => (
                          <DropdownOption
                            key={value}
                            selected={menu.status === value}
                            disabled={saving || themeChanged}
                            onClick={() => update({ ...menu, status: value })}
                          >
                            {t(title)}
                          </DropdownOption>
                        ),
                      )}
                    </DropdownMenu>
                    <small>

                      {t("Only active menus with a selected location appear in the theme. Inactive menus and drafts remain saved in the panel.")}
                    </small>
                  </div>
                </div>
              </CollapsibleSection>
            </fieldset>
            <div className="react-form-actions">
              <LoadingButton
                loading={saving}
                type="submit"
                className="react-primary-button menu-button"
                disabled={!supported || saving || loading || !index || themeChanged}
              >
                <Save size={18} />
                {saving ? t("Saving…") : t("Save menu")}
              </LoadingButton>
            </div>
          </form>
        </ExtensionScope>
      )}
    </AdminShell>
  )
}
