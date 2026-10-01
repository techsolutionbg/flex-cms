import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-[#d4d9cf] bg-white shadow-[0_1.5rem_4rem_rgb(30_42_31_/_12%)]", className)} {...props} />
}
