import type { InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "react-ui-input min-h-12 w-full rounded-[0.6rem] border px-5 py-3 text-base outline-none transition",
        className,
      )}
      {...props}
    />
  )
}
