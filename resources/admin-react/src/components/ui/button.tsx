import type { ComponentPropsWithRef } from "react"
import { cn } from "@/lib/utils"
import { LoadingButton } from "@/components/loading-button"

type ButtonVariant = "primary" | "secondary" | "dropdown-trigger" | "dropdown-option"

const variants: Record<ButtonVariant, string> = {
  primary:
    "react-action-button react-ui-button inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-normal transition disabled:cursor-not-allowed",
  secondary:
    "react-action-button react-secondary-button inline-flex items-center justify-center gap-2 transition",
  "dropdown-trigger": "universal-dropdown-trigger",
  "dropdown-option": "universal-dropdown-option",
}

export function Button({
  className,
  variant = "primary",
  loading = false,
  ...props
}: ComponentPropsWithRef<"button"> & { variant?: ButtonVariant; loading?: boolean }) {
  if (variant === "primary" || variant === "secondary")
    return (
      <LoadingButton className={cn(variants[variant], className)} loading={loading} {...props}>
        {props.children}
      </LoadingButton>
    )
  return <button className={cn(variants[variant], className)} {...props} />
}
