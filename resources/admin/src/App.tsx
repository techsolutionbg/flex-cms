import { useEffect, useState } from "react"

import { AdminShell } from "@/components/layout/AdminShell"
import { DashboardPage } from "@/pages/DashboardPage"
import { UpdatesPage } from "@/pages/UpdatesPage"
import { ProfilePage } from "@/pages/ProfilePage"
import { PagesPage } from "@/pages/PagesPage"
import type { AdminBootstrap } from "@/types"

export function App({ bootstrap }: { bootstrap: AdminBootstrap }) {
  const [currentBootstrap, setCurrentBootstrap] = useState(bootstrap)
  const [navigating, setNavigating] = useState(false)

  useEffect(() => {
    let disposed = false

    async function navigate(url: string, replace = false): Promise<void> {
      const target = new URL(url, window.location.href)
      if (target.origin !== window.location.origin || !target.pathname.startsWith("/admin")) return

      setNavigating(true)
      try {
        const response = await fetch(target.href, {
          credentials: "same-origin",
          headers: { Accept: "text/html", "X-Requested-With": "XMLHttpRequest" },
        })
        if (!response.ok) throw new Error("Admin navigation failed")
        const markup = await response.text()
        const document = new DOMParser().parseFromString(markup, "text/html")
        const bootstrapElement = document.getElementById("flex-admin-bootstrap")
        if (!bootstrapElement) throw new Error("Admin bootstrap is missing")
        const nextBootstrap = JSON.parse(bootstrapElement.textContent ?? "{}") as AdminBootstrap
        if (disposed) return
        setCurrentBootstrap(nextBootstrap)
        window.history[replace ? "replaceState" : "pushState"]({}, "", target.href)
        window.document.title = document.title || "Flex CMS"
      } catch {
        window.location.assign(target.href)
      } finally {
        if (!disposed) setNavigating(false)
      }
    }

    function handleClick(event: MouseEvent): void {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest<HTMLAnchorElement>("a[href]")
      if (!link || link.target || link.hasAttribute("download")) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/admin")) return
      event.preventDefault()
      void navigate(url.href)
    }

    function handlePopState(): void { void navigate(window.location.href, true) }
    document.addEventListener("click", handleClick)
    window.addEventListener("popstate", handlePopState)
    return () => {
      disposed = true
      document.removeEventListener("click", handleClick)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [])

  return (
    <AdminShell bootstrap={currentBootstrap} navigating={navigating}>
      {currentBootstrap.page === "updates" ? (
        <UpdatesPage bootstrap={currentBootstrap} />
      ) : currentBootstrap.page === "profile" ? (
        <ProfilePage bootstrap={currentBootstrap} />
      ) : currentBootstrap.page === "pages" ? (
        <PagesPage bootstrap={currentBootstrap} />
      ) : (
        <DashboardPage />
      )}
    </AdminShell>
  )
}
