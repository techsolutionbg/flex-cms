import { createRoot } from "react-dom/client"
import { App } from "@/App"
import { ThemeProvider } from "@/components/theme-provider"
import type { AdminBootstrap } from "@/types"
import "@/styles/globals.css"

const root = document.getElementById("flex-admin-root")
const bootstrapElement = document.getElementById("flex-admin-bootstrap")
if (root && bootstrapElement) {
  const bootstrap = JSON.parse(
    bootstrapElement.textContent ?? "{}"
  ) as AdminBootstrap
  createRoot(root).render(
    <ThemeProvider storageKey="flexcms.admin.theme">
      <App bootstrap={bootstrap} />
    </ThemeProvider>
  )
}
