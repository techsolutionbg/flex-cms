import { useEffect, useRef, useState } from "react"
import { Save, Settings2 } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownMenu, DropdownOption, DropdownChevron } from "@/components/dropdown-menu"
import { useWorkspaceChanged } from "@/components/admin-workspace-context"
import { menuRequest, type MenuIndex, type MenuRecord, type MenuStatus } from "@/lib/menu-api"
import type { MenuShellProps } from "./menus-page"

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
      toast.success("Менюто е запазено.")
    } catch (error) {
      setFailure((error as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <AdminShell {...shell} title={menu.id ? `Меню: ${menu.name}` : "Ново меню"} activeItem="Менюта">
      <div className="react-page-heading">
        <div>
          <h1>{menu.id ? "Редактиране на меню" : "Създаване на меню"}</h1>
          <Breadcrumbs
            onHomeClick={() => shell.onNavigate("Табло")}
            items={[{ label: "Менюта", onClick: onBack }, { label: menu.name || "Ново меню" }]}
          />
        </div>
        {menu.id > 0 && (
          <button type="button" onClick={() => onStructure(menu.id)}>
            Структура на менюто
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
          Активната тема е сменена. Презаредете данните, за да изберете нейните локации.
        </p>
      )}
      {!supported ? (
        <p>Активната тема не поддържа управление на менюта. Незапазените промени остават в таба.</p>
      ) : loading ? (
        <p role="status">Зареждане на менюто…</p>
      ) : (
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
              title="Настройки на менюто"
              icon={Settings2}
              storageKey="menu-editor-settings"
            >
              <div className="react-form-grid">
                <label className="react-form-field">
                  <span>Име</span>
                  <input
                    value={menu.name}
                    maxLength={120}
                    required
                    onChange={(event) => update({ ...menu, name: event.target.value })}
                  />
                  <small>Въведете описателно име, по което да разпознавате менюто в панела.</small>
                </label>
                <label className="react-form-field">
                  <span>Идентификатор (по желание)</span>
                  <input
                    value={menu.slug}
                    maxLength={120}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    placeholder="Генерира се от името"
                    onChange={(event) => update({ ...menu, slug: event.target.value })}
                  />
                  <small>
                    Оставете празно за автоматично генериране от името. При ръчно задаване
                    използвайте малки латински букви, цифри и тирета.
                  </small>
                </label>
                <div className="react-form-field">
                  <span>Локация</span>
                  <DropdownMenu
                    ariaLabel="Локация на менюто"
                    triggerClassName="react-form-select"
                    trigger={
                      <>
                        <span>{index?.menu_locations[location] ?? "— Без локация —"}</span>
                        <DropdownChevron />
                      </>
                    }
                  >
                    <DropdownOption
                      selected={location === ""}
                      disabled={saving || themeChanged}
                      onClick={() => selectLocation("")}
                    >
                      — Без локация —
                    </DropdownOption>
                    {Object.entries(index?.menu_locations ?? {}).map(([key, title]) => (
                      <DropdownOption
                        key={key}
                        selected={location === key}
                        disabled={saving || themeChanged}
                        onClick={() => selectLocation(key)}
                      >
                        {title}
                      </DropdownOption>
                    ))}
                  </DropdownMenu>
                  <small>
                    Изберете къде активната тема да показва менюто. „Без локация“ го запазва без
                    място за показване в темата.
                  </small>
                  {occupiedMenu && (
                    <small>
                      Тази локация се използва от „{occupiedMenu.name}“. При запис ще бъде свързана
                      с това меню.
                    </small>
                  )}
                </div>
                <div className="react-form-field">
                  <span>Статус</span>
                  <DropdownMenu
                    ariaLabel="Статус на менюто"
                    triggerClassName="react-form-select"
                    trigger={
                      <>
                        <span>{statusLabels[menu.status]}</span>
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
                          {title}
                        </DropdownOption>
                      ),
                    )}
                  </DropdownMenu>
                  <small>
                    Само активните менюта с избрана локация се показват в темата. Неактивните менюта
                    и черновите остават запазени в панела.
                  </small>
                </div>
              </div>
            </CollapsibleSection>
          </fieldset>
          <div className="react-form-actions">
            <button
              type="submit"
              className="react-primary-button menu-button"
              disabled={!supported || saving || loading || !index || themeChanged}
            >
              <Save size={18} />
              {saving ? "Запазване…" : "Запази менюто"}
            </button>
          </div>
        </form>
      )}
    </AdminShell>
  )
}
