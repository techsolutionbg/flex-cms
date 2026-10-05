import { createContext, useContext } from "react"
import { X } from "lucide-react"

export type WorkspaceTab = { id: string; title: string; dirty: boolean }
export type ThemeCapabilities = {
  theme: string | null
  supports: { menus: boolean }
  menu_locations: Record<string, string>
}
export const AdminWorkspaceContext = createContext<{
  tabs: WorkspaceTab[]
  active: string
  panel: string
  activate: (id: string) => void
  close: (id: string) => void
  saved: () => void
  changed: () => void
  refresh: () => void
  refreshing: boolean
  themeCapabilities: ThemeCapabilities | null
  capabilitiesError: string | null
} | null>(null)

export function useWorkspaceSaved() {
  return useContext(AdminWorkspaceContext)?.saved
}

export function useWorkspaceChanged() {
  return useContext(AdminWorkspaceContext)?.changed
}

export function AdminWorkspaceTabs() {
  const workspace = useContext(AdminWorkspaceContext)
  if (!workspace || workspace.panel !== workspace.active) return null
  return (
    <div className="admin-workspace-tabs" role="tablist" aria-label="Отворени страници">
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
            <span className="admin-workspace-tab-title">{tab.title}</span>
            {tab.dirty && (
              <span className="admin-workspace-dirty" aria-label="Незапазени промени">
                ●
              </span>
            )}
          </button>
          <button
            type="button"
            className="admin-workspace-close"
            aria-label={`Затвори ${tab.title}`}
            onClick={() => workspace.close(tab.id)}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
