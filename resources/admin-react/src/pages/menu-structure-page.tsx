import { LoadingButton } from "@/components/loading-button"
import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, FileText, GripVertical, ListTree, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { CollapsibleSection } from "@/components/collapsible-section"
import {
  descendants,
  orderedMenuItems,
  placeMenuItem,
  menuRequest,
  type MenuIndex,
  type MenuItem,
  type MenuRecord,
  type MenuDropMode,
} from "@/lib/menu-api"
import { useWorkspaceChanged, useWorkspaceSaved } from "@/components/admin-workspace-context"
import type { MenuShellProps } from "./menus-page"

const pageStatusLabels: Record<string, string> = {
  published: "Публикувана",
  active: "Активна",
  inactive: "Неактивна",
  draft: "Чернова",
  pending: "За преглед",
  scheduled: "Планирана",
  archived: "Архивирана",
}

export function MenuStructurePage({
  menuId,
  capabilities,
  error,
  ...shell
}: MenuShellProps & { menuId: number }) {
  const [pages, setPages] = useState<MenuIndex["pages"]>([])
  const [menu, setMenu] = useState<MenuRecord | null>(null)
  const [search, setSearch] = useState("")
  const [selectedPageIds, setSelectedPageIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState("")
  const [saving, setSaving] = useState(false)
  const drag = useRef<{ id: string; x: number; y: number } | null>(null)
  const drop = useRef<{ target: string; mode: MenuDropMode } | null>(null)
  const [dropPreview, setDropPreview] = useState<{ target: string; mode: MenuDropMode } | null>(
    null,
  )
  const loadedMenuId = useRef<number | null>(null)
  const changed = useWorkspaceChanged()
  const saved = useWorkspaceSaved()
  const supported = capabilities?.supports.menus === true
  useEffect(() => {
    if (!supported) return
    if (loadedMenuId.current === menuId) return
    const abort = new AbortController()
    setLoading(true)
    setFailure("")
    setPages([])
    setMenu(null)
    Promise.all([
      menuRequest<MenuIndex>("/api/admin/menus", "GET", undefined, abort.signal),
      menuRequest<{ menu: MenuRecord }>(
        `/api/admin/menus/${menuId}`,
        "GET",
        undefined,
        abort.signal,
      ),
    ])
      .then(([index, record]) => {
        if (abort.signal.aborted) return
        setPages([...index.pages].sort((a, b) => a.title.localeCompare(b.title, "bg")))
        setMenu(record.menu)
        loadedMenuId.current = menuId
        setSelectedPageIds(new Set())
      })
      .catch((error) => {
        if (!abort.signal.aborted) setFailure((error as Error).message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [menuId, supported])
  const query = search.trim().toLocaleLowerCase("bg")
  const projectedItems =
    menu && dropPreview && drag.current
      ? placeMenuItem(menu.items, drag.current.id, dropPreview.target, dropPreview.mode)
      : null
  const projectedIndex = projectedItems?.findIndex((item) => item.id === drag.current?.id) ?? -1
  const projectedItem = projectedItems?.[projectedIndex]
  const markerAfterId = projectedItems?.[projectedIndex - 1]?.id
  const projectedBranch =
    projectedItem && menu ? descendants(menu.items, projectedItem.id) : new Set<string>()
  const markerBeforeId =
    projectedIndex === 0
      ? projectedItems?.find((item) => !projectedBranch.has(item.id))?.id
      : undefined
  const projectedParent = menu?.items.find((item) => item.id === projectedItem?.parent_id)
  let projectedDepth = 0
  let projectedAncestor = projectedItem?.parent_id
  while (projectedAncestor && projectedDepth < 2) {
    projectedDepth++
    projectedAncestor = projectedItems?.find((item) => item.id === projectedAncestor)?.parent_id
  }
  const visiblePages = pages.filter((page) => page.title.toLocaleLowerCase("bg").includes(query))
  function queueSelectedPages() {
    if (!menu || saving || selectedPageIds.size === 0) return
    const existingPageIds = new Set(
      menu.items.filter((item) => item.type === "page").map((item) => item.page_id),
    )
    const newItems: MenuItem[] = pages
      .filter((page) => selectedPageIds.has(page.id) && !existingPageIds.has(page.id))
      .map(
        (page): MenuItem => ({
          id: crypto.randomUUID(),
          parent_id: null,
          label: page.title,
          type: "page",
          page_id: page.id,
          url: "",
          new_tab: false,
        }),
      )
    if (menu.items.length + newItems.length > 100) {
      toast.error("Менюто може да съдържа до 100 елемента.")
      return
    }
    if (newItems.length) updateItems([...menu.items, ...newItems])
    setSelectedPageIds(new Set())
    toast.success(
      newItems.length
        ? `${newItems.length} ${newItems.length === 1 ? "страница е добавена" : "страници са добавени"} към менюто. Запазете структурата.`
        : "Избраните страници вече са добавени към менюто.",
    )
  }
  function updateItems(items: MenuItem[]) {
    if (!menu || saving || items === menu.items) return
    setMenu({ ...menu, items })
    changed?.()
  }
  function place(id: string, target: string, mode: MenuDropMode) {
    if (!menu || saving) return
    const next = placeMenuItem(menu.items, id, target, mode)
    if (next === menu.items) return
    updateItems(next)
  }
  function resetDrag() {
    drag.current = null
    drop.current = null
    setDropPreview(null)
  }
  function updateItem(id: string, patch: Partial<MenuItem>) {
    if (menu) updateItems(menu.items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }
  async function save() {
    if (!menu || saving || loading || !supported) return
    setSaving(true)
    setFailure("")
    try {
      const result = await menuRequest<{ menu: MenuRecord }>(
        `/api/admin/menus/${menu.id}`,
        "PUT",
        menu,
      )
      setMenu(result.menu)
      saved?.()
      toast.success("Структурата на менюто е запазена.")
    } catch (error) {
      setFailure((error as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <AdminShell {...shell} title="Структура на менюто" activeItem="Менюта">
      <div className="react-page-heading">
        <div>
          <h1>Структура на менюто{menu ? `: ${menu.name}` : ""}</h1>
          <Breadcrumbs
            onHomeClick={() => shell.onNavigate("Табло")}
            items={[
              { label: "Менюта", onClick: () => shell.onNavigate("Менюта") },
              { label: menu?.name ?? "Структура на менюто" },
            ]}
          />
        </div>
        {supported && (!failure || menu) && (
          <div className="react-form-actions menu-structure-heading-actions">
            <LoadingButton
              loading={saving}
              type="submit"
              form={`menu-structure-form-${menuId}`}
              className="react-primary-button menu-button"
              disabled={saving || loading || !menu}
            >
              <Save size={18} />
              {saving ? "Запазване…" : "Запази структурата"}
            </LoadingButton>
          </div>
        )}
      </div>
      {(error || failure) && (
        <p className="react-form-error" role="alert">
          {error || failure}
        </p>
      )}
      {!capabilities ? (
        <p role="status">Зареждане…</p>
      ) : !supported ? (
        <p>Активната тема не поддържа управление на менюта.</p>
      ) : (
        (!failure || menu) && (
          <form
            id={`menu-structure-form-${menuId}`}
            className="react-page-form menu-structure-form"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <div className="menu-structure-layout" data-menu-id={menuId}>
              <aside aria-label="Налични страници">
                <CollapsibleSection
                  title="Страници"
                  icon={FileText}
                  storageKey="menu-structure-pages"
                >
                  <label className="react-form-field">
                    <span>Търсене на страница</span>
                    <input
                      type="search"
                      value={search}
                      placeholder="Търсене по заглавие…"
                      onChange={(event) => setSearch(event.target.value)}
                      disabled={loading || saving}
                    />
                    <small>Всички налични страници, независимо от статуса им.</small>
                  </label>
                  {loading ? (
                    <p role="status">Зареждане на страниците…</p>
                  ) : (
                    <>
                      <p className="react-muted" role="status">
                        Показани: {visiblePages.length} от {pages.length}
                      </p>
                      {visiblePages.length ? (
                        <ul className="menu-structure-pages" aria-label="Списък със страници">
                          {visiblePages.map((page) => (
                            <li key={page.id}>
                              <label className="menu-structure-page-row">
                                <input
                                  type="checkbox"
                                  disabled={saving}
                                  checked={selectedPageIds.has(page.id)}
                                  onChange={(event) =>
                                    setSelectedPageIds((current) => {
                                      const next = new Set(current)
                                      if (event.target.checked) next.add(page.id)
                                      else next.delete(page.id)
                                      return next
                                    })
                                  }
                                  aria-label={`Избери страницата ${page.title}`}
                                />
                                <span className="menu-structure-page-title" title={page.title}>
                                  {page.title}
                                </span>
                              </label>
                              <span className={`react-status-badge status-${page.status}`}>
                                {pageStatusLabels[page.status] ?? page.status}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="react-muted">
                          {pages.length
                            ? "Няма страници, съответстващи на търсенето."
                            : "Все още няма създадени страници."}
                        </p>
                      )}
                      <div className="menu-structure-pages-footer">
                        <button
                          className="react-primary-button menu-button"
                          type="button"
                          disabled={selectedPageIds.size === 0 || !menu || saving}
                          onClick={queueSelectedPages}
                        >
                          Добави избраните страници
                          {selectedPageIds.size > 0 ? ` (${selectedPageIds.size})` : ""}
                        </button>
                      </div>
                    </>
                  )}
                </CollapsibleSection>
              </aside>
              <div className="menu-structure-items">
                <CollapsibleSection
                  title="Елементи на менюто"
                  icon={ListTree}
                  storageKey={`menu-structure-items-${menuId}`}
                >
                  {loading ? (
                    <p role="status">Зареждане на елементите…</p>
                  ) : !menu?.items.length ? (
                    <p className="react-muted">
                      Изберете страници и натиснете „Добави избраните страници“.
                    </p>
                  ) : (
                    <div className="menu-structure-item-list">
                      <p className="react-muted">
                        Влачете дръжката надясно за подменю на горния елемент и наляво за връщане на
                        предишното ниво. Влачете нагоре или надолу за промяна на реда. До три нива.
                      </p>
                      {orderedMenuItems(menu.items).map((item) => {
                        const siblings = menu.items.filter(
                          (sibling) => sibling.parent_id === item.parent_id,
                        )
                        const position = siblings.findIndex((sibling) => sibling.id === item.id)
                        let depth = 0
                        let parent = item.parent_id
                        while (parent && depth < 2) {
                          depth++
                          parent =
                            menu.items.find((entry) => entry.id === parent)?.parent_id ?? null
                        }
                        return (
                          <div
                            key={item.id}
                            data-menu-item={item.id}
                            className={`menu-structure-draggable${dropPreview?.target === item.id ? ` is-drop-${dropPreview.mode}` : ""}`}
                            style={{ marginInlineStart: `${depth * 1.5}rem` }}
                          >
                            {(markerAfterId === item.id || markerBeforeId === item.id) &&
                              projectedItem && (
                                <div
                                  className={`menu-structure-drop-marker${markerBeforeId === item.id ? " is-before" : ""}`}
                                  role="status"
                                  style={{
                                    insetInlineStart: `${(projectedDepth - depth) * 1.5}rem`,
                                  }}
                                >
                                  <span>
                                    {projectedItem.label} —{" "}
                                    {projectedParent
                                      ? `подменю на „${projectedParent.label}“`
                                      : "основно ниво"}
                                  </span>
                                </div>
                              )}
                            <button
                              type="button"
                              className="menu-structure-drag-handle"
                              aria-label={`Премести ${item.label}`}
                              title="Влачи за подреждане; надясно за подменю"
                              disabled={saving}
                              onPointerDown={(event) => {
                                if (event.button !== 0 || saving) return
                                event.preventDefault()
                                event.currentTarget.focus()
                                event.currentTarget.setPointerCapture(event.pointerId)
                                drag.current = { id: item.id, x: event.clientX, y: event.clientY }
                              }}
                              onPointerMove={(event) => {
                                if (!drag.current) return
                                const dx = event.clientX - drag.current.x
                                const dy = event.clientY - drag.current.y
                                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
                                const row = document
                                  .elementFromPoint(event.clientX, event.clientY)
                                  ?.closest<HTMLElement>("[data-menu-item]")
                                if (!row?.dataset.menuItem) {
                                  drop.current = null
                                  setDropPreview(null)
                                  return
                                }
                                const mode: MenuDropMode =
                                  dx >= 28
                                    ? "inside"
                                    : dx <= -28
                                      ? "outdent"
                                      : event.clientY <
                                          row.getBoundingClientRect().top +
                                            row.getBoundingClientRect().height / 2
                                        ? "before"
                                        : "after"
                                const candidate = { target: row.dataset.menuItem, mode }
                                if (
                                  placeMenuItem(
                                    menu.items,
                                    drag.current.id,
                                    candidate.target,
                                    mode,
                                  ) === menu.items
                                ) {
                                  drop.current = null
                                  setDropPreview(null)
                                  return
                                }
                                drop.current = candidate
                                setDropPreview(candidate)
                              }}
                              onPointerUp={(event) => {
                                if (drag.current && drop.current)
                                  place(drag.current.id, drop.current.target, drop.current.mode)
                                if (event.currentTarget.hasPointerCapture(event.pointerId))
                                  event.currentTarget.releasePointerCapture(event.pointerId)
                                resetDrag()
                              }}
                              onPointerCancel={resetDrag}
                              onLostPointerCapture={resetDrag}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  resetDrag()
                                  return
                                }
                                if (event.key === "ArrowRight") {
                                  event.preventDefault()
                                  place(item.id, item.id, "inside")
                                }
                                if (event.key === "ArrowLeft") {
                                  event.preventDefault()
                                  place(item.id, item.id, "outdent")
                                }
                                if (event.key === "ArrowUp" && position > 0) {
                                  event.preventDefault()
                                  place(item.id, siblings[position - 1].id, "before")
                                }
                                if (event.key === "ArrowDown" && position < siblings.length - 1) {
                                  event.preventDefault()
                                  place(item.id, siblings[position + 1].id, "after")
                                }
                              }}
                            >
                              <GripVertical size={18} aria-hidden="true" />
                            </button>
                            <CollapsibleSection
                              key={item.id}
                              title={item.label || "Елемент на менюто"}
                              icon={FileText}
                              storageKey={`menu-item-${menuId}-${item.id}`}
                              defaultOpen={false}
                            >
                              <fieldset className="menu-fieldset" disabled={saving}>
                                <div className="react-form-grid">
                                  {(
                                    [
                                      [
                                        "label",
                                        "Текст на линка",
                                        "Текстът, който посетителите виждат в менюто.",
                                        190,
                                      ],
                                      [
                                        "url",
                                        "Линк",
                                        item.type === "page"
                                          ? "Оставете празно за автоматичния адрес на страницата."
                                          : "HTTP(S) адрес, вътрешен път /… или котва #… .",
                                        2048,
                                      ],
                                      [
                                        "seo_title",
                                        "SEO title",
                                        "По желание: title атрибут на линка, показван при посочване с мишката.",
                                        190,
                                      ],
                                      [
                                        "aria_label",
                                        "Достъпно име (aria-label)",
                                        "По желание: пояснение за потребителите на екранни четци.",
                                        190,
                                      ],
                                      [
                                        "css_class",
                                        "CSS класове",
                                        "По желание: класове, разделени с интервал, за стилизиране от темата.",
                                        190,
                                      ],
                                      [
                                        "rel",
                                        "Атрибути на връзката (rel)",
                                        "По желание: nofollow, sponsored, ugc, external, noopener или noreferrer, разделени с интервал.",
                                        120,
                                      ],
                                    ] as const
                                  ).map(([field, label, hint, limit]) => (
                                    <label key={field} className="react-form-field">
                                      <span>{label}</span>
                                      <input
                                        value={item[field] ?? ""}
                                        maxLength={limit}
                                        required={
                                          field === "label" ||
                                          (field === "url" && item.type === "link")
                                        }
                                        onChange={(event) =>
                                          updateItem(item.id, { [field]: event.target.value })
                                        }
                                      />
                                      <small>{hint}</small>
                                    </label>
                                  ))}
                                </div>
                                <label className="menu-checkbox">
                                  <input
                                    type="checkbox"
                                    checked={item.new_tab}
                                    onChange={(event) =>
                                      updateItem(item.id, { new_tab: event.target.checked })
                                    }
                                  />
                                  Отваряне в нов таб
                                </label>
                                <div className="menu-structure-item-actions">
                                  <button
                                    type="button"
                                    className="react-secondary-button menu-button"
                                    aria-label={`Премести ${item.label} нагоре`}
                                    disabled={saving || position === 0}
                                    onClick={() =>
                                      updateItems(
                                        placeMenuItem(
                                          menu.items,
                                          item.id,
                                          siblings[position - 1]?.id ?? item.id,
                                          "before",
                                        ),
                                      )
                                    }
                                  >
                                    <ArrowUp size={16} />
                                    Нагоре
                                  </button>
                                  <button
                                    type="button"
                                    className="react-secondary-button menu-button"
                                    aria-label={`Премести ${item.label} надолу`}
                                    disabled={saving || position === siblings.length - 1}
                                    onClick={() =>
                                      updateItems(
                                        placeMenuItem(
                                          menu.items,
                                          item.id,
                                          siblings[position + 1]?.id ?? item.id,
                                          "after",
                                        ),
                                      )
                                    }
                                  >
                                    <ArrowDown size={16} />
                                    Надолу
                                  </button>
                                  <button
                                    type="button"
                                    className="react-secondary-button menu-button"
                                    onClick={() => {
                                      const removed = descendants(menu.items, item.id)
                                      updateItems(
                                        menu.items.filter((entry) => !removed.has(entry.id)),
                                      )
                                    }}
                                  >
                                    <Trash2 size={16} />
                                    Премахни от менюто
                                  </button>
                                </div>
                              </fieldset>
                            </CollapsibleSection>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CollapsibleSection>
              </div>
            </div>
            <div className="react-form-actions menu-structure-mobile-actions">
              <LoadingButton
                loading={saving}
                type="submit"
                className="react-primary-button menu-button"
                disabled={saving || loading || !menu}
              >
                <Save size={18} />
                {saving ? "Запазване…" : "Запази структурата"}
              </LoadingButton>
            </div>
          </form>
        )
      )}
    </AdminShell>
  )
}
