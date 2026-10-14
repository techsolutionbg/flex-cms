import { MoreHorizontal } from "lucide-react"
import { Children, useContext, type ReactNode } from "react"
import { DropdownMenu, DropdownOption } from "./dropdown-menu"
import { RowExtensionActionsContext } from "./extension-runtime"

export function TableActionsMenu({ children }: { children: ReactNode }) {
  // Row actions that plugins add to this table (slot table.row-action), after the screen's own options.
  const extension = useContext(RowExtensionActionsContext)
  const actions = (extension?.actions ?? []).filter(
    (action) => {
      if (action.contentBuilder) {
        const row = extension!.row as { settings?: { content_builder?: string | null } }
        if (row.settings?.content_builder !== action.contentBuilder) return false
      }
      return !action.visible || action.visible(extension!.row)
    },
  )
  if (Children.count(children) === 0 && actions.length === 0) return null
  return (
    <DropdownMenu
      ariaLabel="Действия"
      triggerClassName="table-actions-trigger-react"
      trigger={<MoreHorizontal aria-hidden="true" />}
    >
      {children}
      {actions.map((action) => (
        <DropdownOption
          key={action.label}
          danger={action.danger}
          onClick={() => void action.onSelect(extension!.row, extension!.helpers)}
        >
          {action.label}
        </DropdownOption>
      ))}
    </DropdownMenu>
  )
}
