import { Search } from "lucide-react"
import { useContext, useEffect, useId, useMemo, useRef, useState } from "react"
import { FilterField } from "./filter-field"
import { AdminWorkspaceContext } from "./admin-workspace-context"
import {
  CORE_PANEL_SEARCH_TARGETS,
  filterPanelSearchTargets,
  type PanelSearchTarget,
} from "@/lib/admin-panel-search"
import { normalizeSettingsWorkspacePath } from "@/lib/settings-tabs"

export function AdminPanelSearch() {
  const workspace = useContext(AdminWorkspaceContext)
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const targets = useMemo(() => {
    const navigation = workspace?.themeCapabilities?.admin_navigation
    const groupLabels: Record<string, string> = {
      overview: "Основни",
      content: "Съдържание",
      appearance: "Външен вид",
      commerce: "Магазин",
      management: "Управление",
      system: "Система",
      extensions: "Допълнителни инструменти",
      account: "Акаунт",
    }
    for (const group of navigation?.groups ?? []) groupLabels[group.id] = group.label
    const themeTargets: PanelSearchTarget[] = (navigation?.items ?? []).flatMap((item) =>
      item.href
        ? [
            {
              id: `theme-${item.id}`,
              label: item.label,
              group: groupLabels[item.group] ?? "Тема",
              path: item.href,
              keywords: item.href,
            },
          ]
        : [],
    )
    const extensionTargets: PanelSearchTarget[] = (workspace?.extensionPages ?? []).map((page) => ({
      id: `ext-${page.href}`,
      label: page.label,
      group: "Разширения",
      path: page.href,
      keywords: page.href,
    }))
    const tabTargets: PanelSearchTarget[] = (workspace?.tabs ?? [])
      .filter((tab) => tab.path !== "/")
      .map((tab) => ({
        id: `tab-${tab.id}`,
        label: tab.title,
        group: "Отворени табове",
        path: tab.path,
      }))
    const merged = [...CORE_PANEL_SEARCH_TARGETS, ...themeTargets, ...extensionTargets, ...tabTargets]
    const seen = new Set<string>()
    return merged.filter((target) => {
      const key = `${target.path}:${target.settingsTab ?? ""}:${target.label}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [workspace?.extensionPages, workspace?.tabs, workspace?.themeCapabilities?.admin_navigation])

  const results = useMemo(
    () => filterPanelSearchTargets(targets, query, 12),
    [targets, query],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  function go(target: PanelSearchTarget) {
    const path = normalizeSettingsWorkspacePath(target.path)
    if (workspace?.open) workspace.open(path)
    else window.location.assign(path)
    setQuery("")
    setOpen(false)
    inputRef.current?.blur()
  }

  const showResults = open && (query.trim() !== "" || results.length > 0)

  return (
    <div className="admin-topbar-search" ref={rootRef}>
      <Search className="admin-topbar-search-icon" size={18} aria-hidden="true" />
      <FilterField
        ref={inputRef}
        hideLabel
        label="Търсене в административния панел"
        className="admin-topbar-search-field"
        type="search"
        role="combobox"
        aria-expanded={showResults}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Търси страници, секции и опции…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false)
            inputRef.current?.blur()
            return
          }
          if (!showResults || results.length === 0) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((index) => (index + 1) % results.length)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((index) => (index - 1 + results.length) % results.length)
          } else if (event.key === "Enter") {
            event.preventDefault()
            const target = results[activeIndex]
            if (target) go(target)
          }
        }}
      />
      {showResults && (
        <ul className="admin-topbar-search-results" id={listId} role="listbox">
          {results.length === 0 ? (
            <li className="admin-topbar-search-empty" role="option" aria-selected={false}>
              Няма съвпадения
            </li>
          ) : (
            results.map((target, index) => (
              <li key={target.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`admin-topbar-search-option${index === activeIndex ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(target)}
                >
                  <span className="admin-topbar-search-option-label">{target.label}</span>
                  <span className="admin-topbar-search-option-group">{target.group}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
