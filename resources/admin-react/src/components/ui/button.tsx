import type { ComponentPropsWithRef } from "react"
import { cn } from "@/lib/utils"

type ButtonVariant = "primary" | "secondary" | "dropdown-trigger" | "dropdown-option"

const variants: Record<ButtonVariant, string> = {
  primary:
    "react-ui-button inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-bold transition disabled:cursor-not-allowed",
  secondary: "react-secondary-button inline-flex items-center justify-center gap-2 transition",
  "dropdown-trigger": "universal-dropdown-trigger",
  "dropdown-option": "universal-dropdown-option",
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ComponentPropsWithRef<"button"> & { variant?: ButtonVariant }) {
  return <button className={cn(variants[variant], className)} {...props} />
}
