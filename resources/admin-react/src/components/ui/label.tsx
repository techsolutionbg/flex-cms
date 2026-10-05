import type { LabelHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("react-ui-label text-sm font-normal", className)} {...props} />
}
