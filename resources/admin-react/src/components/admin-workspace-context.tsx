import { t } from "@/lib/admin-i18n"
import { createContext, useContext } from "react"
import { ListX, X } from "lucide-react"
import { Button } from "./ui/button"
import type { ExtensionPageDescriptor } from "./extension-page"
import type { ExtensionDescriptor } from "./extension-runtime"

export type WorkspaceTab = { id: string; path: string; title: string; dirty: boolean; namespace?: string }
export type PageTemplateOption = { id: string; label: string }

export type ThemeAdminNavigation = {
  groups: { id: string; label: string; icon: string; order: number }[]
  sections: { id: string; label: string; icon: string; group: string; order: number }[]
  items: {
    id: string
    label: string
    icon: string
    href: string
    group: string
    section: string
    order: number
  }[]
}

export type ThemeResourceDefinition = {
  id: string
  label: string
  singular: string
  icon: string
  group: string
  order: number
  public_page: string
}

export type ThemeCapabilities = {
  theme: string | null
  supports: { menus: boolean }
  menu_locations: Record<string, string>
  page_templates?: PageTemplateOption[]
  admin_navigation?: ThemeAdminNavigation
  resources?: ThemeResourceDefinition[]
}
export const AdminWorkspaceContext = createContext<{
  tabs: WorkspaceTab[]
  active: string
  panel: string
  activate: (id: string) => void
  close: (id: string) => void
  closeAll: () => void
  canCloseAll: boolean
  saved: () => void
  changed: () => void
  refresh: () => void
  rename: (title: string) => void
  open?: (path: string) => void
  refreshing: boolean
  themeCapabilities: ThemeCapabilities | null
  capabilitiesError: string | null
  extensionPages?: ExtensionPageDescriptor[]
  extensions?: ExtensionDescriptor[]
} | null>(null)

export function useWorkspaceSaved() {
  return useContext(AdminWorkspaceContext)?.saved
}

export function useWorkspaceTitle() {
  return useContext(AdminWorkspaceContext)?.rename
}

export function useWorkspaceChanged() {
  return useContext(AdminWorkspaceContext)?.changed
}

/** True only for the visible workspace panel; hidden keep-alive tabs stay false. */
export function useWorkspacePanelActive() {
  const workspace = useContext(AdminWorkspaceContext)
  return Boolean(workspace && workspace.panel === workspace.active)
}

export function AdminWorkspaceTabs() {
  const workspace = useContext(AdminWorkspaceContext)
  if (!workspace || workspace.panel !== workspace.active) return null
  return (
    <div className="admin-workspace-tabbar">
      <div className="admin-workspace-tabs" role="tablist" aria-label={t("Open pages")}>
        {workspace.tabs.map((tab, index) => (
          <div
            className="admin-workspace-tab"
            data-active={tab.id === workspace.active}
            key={tab.id}
            onMouseDown={(event) => {
              if (event.button === 1) event.preventDefault()
            }}
            onAuxClick={(event) => {
              if (event.button !== 1) return
              event.preventDefault()
              workspace.close(tab.id)
            }}
          >
            <button
              type="button"
              role="tab"
              id={`workspace-tab-${tab.id}`}
              aria-controls={`workspace-panel-${tab.id}`}
              aria-selected={tab.id === workspace.active}
              tabIndex={tab.id === workspace.active ? 0 : -1}
              onClick={() => workspace.activate(tab.id)}
              onKeyDown={(event) => {
                let next = index
                if (event.key === "ArrowRight") next = (index + 1) % workspace.tabs.length
                else if (event.key === "ArrowLeft")
                  next = (index - 1 + workspace.tabs.length) % workspace.tabs.length
                else if (event.key === "Home") next = 0
                else if (event.key === "End") next = workspace.tabs.length - 1
                else if (event.key === "Delete") {
                  workspace.close(tab.id)
                  return
                } else return
                event.preventDefault()
                workspace.activate(workspace.tabs[next].id)
                requestAnimationFrame(() =>
                  document.getElementById(`workspace-tab-${workspace.tabs[next].id}`)?.focus(),
                )
              }}
            >
              <span className="admin-workspace-tab-title">{t(tab.title, tab.namespace)}</span>
              {tab.dirty && (
                <span className="admin-workspace-dirty" aria-label={t("Unsaved changes")}>
                  ●
                </span>
              )}
            </button>
            <button
              type="button"
              className="admin-workspace-close"
              aria-label={`${t("Close")} ${t(tab.title, tab.namespace)}`}
              onClick={() => workspace.close(tab.id)}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        type="button"
        className="admin-workspace-close-all"
        aria-label={t("Close all tabs")}
        title={t("Close all tabs")}
        disabled={!workspace.canCloseAll}
        onClick={workspace.closeAll}
      >
        <ListX aria-hidden="true" />
        <span>{t("Close all")}</span>
      </Button>
    </div>
  )
}
