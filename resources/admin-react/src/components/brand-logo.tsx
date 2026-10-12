import { useSyncExternalStore } from "react"
import { readAdminColorScheme, subscribeAdminColorScheme } from "@/lib/admin-theme"

const logos = {
  light: "/assets/brand/logo.png",
  dark: "/assets/brand/logo-dark.png",
} as const

export function BrandLogo({ className }: { className?: string }) {
  const scheme = useSyncExternalStore(
    subscribeAdminColorScheme,
    readAdminColorScheme,
    () => "light" as const,
  )
  return <img className={className} src={logos[scheme]} alt="Flex CMS" />
}
