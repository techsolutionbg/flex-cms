import type { ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1f2d21] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2d4030] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff563d] disabled:cursor-not-allowed disabled:opacity-60", className)} {...props} />
}
