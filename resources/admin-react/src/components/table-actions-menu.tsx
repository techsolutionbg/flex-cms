import { MoreHorizontal } from "lucide-react"
import type { ReactNode } from "react"
import { DropdownMenu } from "./dropdown-menu"

export function TableActionsMenu({ children }: { children: ReactNode }) {
  return <DropdownMenu ariaLabel="Действия" triggerClassName="table-actions-trigger-react" trigger={<MoreHorizontal aria-hidden="true" />}>{children}</DropdownMenu>
}
