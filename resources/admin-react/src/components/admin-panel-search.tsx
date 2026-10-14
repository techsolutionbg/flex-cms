import { ChevronDown, Search } from "lucide-react"
import { useContext, useEffect, useId, useMemo, useRef, useState } from "react"
import { FilterField } from "./filter-field"
import { AdminWorkspaceContext } from "./admin-workspace-context"
import {
  CORE_PANEL_SEARCH_TARGETS,
  filterPanelSearchTargets,
  type PanelSearchTarget,
} from "@/lib/admin-panel-search"
import { normalizeSettingsWorkspacePath } from "@/lib/settings-tabs"
import { t, useAdminLocale } from "@/lib/admin-i18n"

type SearchSection = { key: string; label: string; targets: PanelSearchTarget[] }
type SearchGroup = {
  key: string
  label: string
  targets: PanelSearchTarget[]
  sections: SearchSection[]
}

export function AdminPanelSearch() {
  const workspace = useContext(AdminWorkspaceContext)
  const locale = useAdminLocale()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({})

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
    const sectionLabels: Record<string, string> = {
      catalog: "Каталог",
      sales: "Продажби",
      customers: "Клиенти",
      settings: "Настройки",
    }
    for (const section of navigation?.sections ?? []) sectionLabels[section.id] = section.label
    const navigationGroup = (groupId: string) => groupLabels[groupId] ?? "Разширения"
    const navigationSection = (sectionId?: string) => (sectionId ? sectionLabels[sectionId] ?? sectionId : undefined)

    const themeTargets: PanelSearchTarget[] = (navigation?.items ?? []).flatMap((item) =>
      item.href
        ? [{
            id: `theme-${item.id}`,
            label: item.label,
            group: navigationGroup(item.group),
            section: navigationSection(item.section),
            path: item.href,
            keywords: [
              item.href,
              groupLabels[item.group],
              item.section ? sectionLabels[item.section] ?? item.section : "",
              t(item.label),
            ]
              .filter(Boolean)
              .join(" "),
          }]
        : [],
    )
    const extensionTargets: PanelSearchTarget[] = (workspace?.extensionPages ?? [])
      .filter((page) => !page.navigation?.hidden)
      .map((page) => {
        const groupId = page.navigation?.group ?? "extensions"
        const sectionId = page.navigation?.section
        return {
          id: `ext-${page.href}`,
          label: page.label,
          group: navigationGroup(groupId),
          section: navigationSection(sectionId),
          path: page.href,
          namespace: page.plugin,
          keywords: [
            page.href,
            groupLabels[groupId],
            sectionId ? sectionLabels[sectionId] ?? sectionId : "",
            t(page.label, page.plugin),
          ]
            .filter(Boolean)
            .join(" "),
        }
      })
    const tabTargets: PanelSearchTarget[] = (workspace?.tabs ?? [])
      .filter((tab) => tab.path !== "/")
      .map((tab) => ({
        id: `tab-${tab.id}`,
        label: tab.title,
        namespace: tab.namespace,
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
  }, [locale, workspace?.extensionPages, workspace?.tabs, workspace?.themeCapabilities?.admin_navigation])

  const results = useMemo(() => filterPanelSearchTargets(targets, query, 12), [targets, query])
  const groupedResults = useMemo(() => {
    const groupMap = new Map<string, SearchGroup>()
    for (const target of results) {
      let group = groupMap.get(target.group)
      if (!group) {
        group = { key: target.group, label: t(target.group), targets: [], sections: [] }
        groupMap.set(target.group, group)
      }
      if (target.section) {
        let section = group.sections.find((item) => item.key === target.section)
        if (!section) {
          section = { key: target.section, label: t(target.section), targets: [] }
          group.sections.push(section)
        }
        section.targets.push(target)
      } else {
        group.targets.push(target)
      }
    }
    return [...groupMap.values()]
  }, [results])

  const visibleTargets = useMemo(() => {
    const visible: PanelSearchTarget[] = []
    const autoExpandMatches = query.trim() !== ""
    for (const group of groupedResults) {
      const groupKey = `group:${group.key}`
      const groupExpanded = expandedBranches[groupKey] ?? autoExpandMatches
      if (!groupExpanded) continue
      visible.push(...group.targets)
      for (const section of group.sections) {
        const sectionKey = `section:${group.key}:${section.key}`
        const sectionExpanded = expandedBranches[sectionKey] ?? autoExpandMatches
        if (sectionExpanded) visible.push(...section.targets)
      }
    }
    return visible
  }, [expandedBranches, groupedResults, query])

  useEffect(() => {
    setActiveIndex(0)
    setExpandedBranches({})
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
    const path = target.path === "/settings" || target.path.startsWith("/settings/")
      ? normalizeSettingsWorkspacePath(target.path)
      : target.path
    if (workspace?.open) workspace.open(path)
    else window.location.assign(path)
    setQuery("")
    setOpen(false)
    inputRef.current?.blur()
  }

  function toggleBranch(key: string, defaultExpanded: boolean) {
    setExpandedBranches((current) => ({ ...current, [key]: !(current[key] ?? defaultExpanded) }))
  }

  const showResults = open && (query.trim() !== "" || results.length > 0)
  const activeTargetId = visibleTargets[activeIndex]?.id

  function renderTarget(target: PanelSearchTarget) {
    const index = visibleTargets.findIndex((item) => item.id === target.id)
    const active = target.id === activeTargetId
    return (
      <li key={target.id} role="presentation">
        <button
          type="button"
          role="option"
          aria-selected={active}
          className={`admin-topbar-search-option${active ? " is-active" : ""}`}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => go(target)}
        >
          <span className="admin-topbar-search-option-label">{t(target.label, target.namespace)}</span>
          {!target.section && <span className="admin-topbar-search-option-group">{t(target.group)}</span>}
        </button>
      </li>
    )
  }

  return (
    <div className="admin-topbar-search" ref={rootRef}>
      <Search className="admin-topbar-search-icon" size={18} aria-hidden="true" />
      <FilterField
        ref={inputRef}
        hideLabel
        label={t("Search the admin panel")}
        className="admin-topbar-search-field"
        type="search"
        role="combobox"
        aria-expanded={showResults}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={t("Search pages, sections and settings…")}
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
          if (!showResults || visibleTargets.length === 0) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setActiveIndex((index) => (index + 1) % visibleTargets.length)
          } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex((index) => (index - 1 + visibleTargets.length) % visibleTargets.length)
          } else if (event.key === "Enter") {
            event.preventDefault()
            const target = visibleTargets[activeIndex]
            if (target) go(target)
          }
        }}
      />
      {showResults && (
        <ul className="admin-topbar-search-results" id={listId} role="listbox">
          {results.length === 0 ? (
            <li className="admin-topbar-search-empty" role="option" aria-selected={false}>
              {t("No matches")}
            </li>
          ) : (
            groupedResults.map((group) => {
              const groupKey = `group:${group.key}`
              const autoExpandMatches = query.trim() !== ""
              const groupExpanded = expandedBranches[groupKey] ?? autoExpandMatches
              const groupHasBranch = targets.some((target) => target.group === group.key && target.section)
              const groupHasMultiple = targets.filter((target) => target.group === group.key).length > 1
              if (!groupHasBranch && !groupHasMultiple) return group.targets.map(renderTarget)
              return (
                <li className="admin-topbar-search-tree-branch" key={group.key} role="presentation">
                  <button
                    type="button"
                    className="admin-topbar-search-branch"
                    aria-expanded={groupExpanded}
                    onClick={() => toggleBranch(groupKey, autoExpandMatches)}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={groupExpanded ? "is-expanded" : ""} size={16} aria-hidden="true" />
                  </button>
                  <div className={`admin-topbar-search-submenu-transition${groupExpanded ? " is-expanded" : ""}`}>
                    <ul className="admin-topbar-search-children" role="group" aria-label={group.label}>
                      {group.targets.map(renderTarget)}
                      {group.sections.map((section) => {
                        const sectionKey = `section:${group.key}:${section.key}`
                        const sectionExpanded = expandedBranches[sectionKey] ?? autoExpandMatches
                        return (
                          <li className="admin-topbar-search-tree-branch" key={section.key} role="presentation">
                            <button
                              type="button"
                              className="admin-topbar-search-branch is-section"
                              aria-expanded={sectionExpanded}
                              onClick={() => toggleBranch(sectionKey, autoExpandMatches)}
                            >
                              <span>{section.label}</span>
                              <ChevronDown className={sectionExpanded ? "is-expanded" : ""} size={15} aria-hidden="true" />
                            </button>
                            <div className={`admin-topbar-search-submenu-transition${sectionExpanded ? " is-expanded" : ""}`}>
                              <ul className="admin-topbar-search-children" role="group" aria-label={section.label}>
                                {section.targets.map(renderTarget)}
                              </ul>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
