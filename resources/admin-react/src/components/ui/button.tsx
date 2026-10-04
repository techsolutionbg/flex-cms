import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "react-ui-button inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  )
}
