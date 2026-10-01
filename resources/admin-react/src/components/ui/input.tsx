import type { InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("min-h-12 w-full rounded-[0.6rem] border border-[#cbd3c7] bg-white px-5 py-3 text-base text-[#172118] outline-none transition placeholder:text-[#89938a] focus:border-[#ff563d] focus:ring-2 focus:ring-[#ff563d]/20", className)} {...props} />
}
