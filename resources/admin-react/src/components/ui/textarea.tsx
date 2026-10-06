import type { ComponentPropsWithRef } from "react"
import { cn } from "@/lib/utils"

export function Textarea({ className, rows = 3, ...props }: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      className={cn("react-ui-input react-ui-textarea", className)}
      rows={rows}
      {...props}
    />
  )
}
