import { createRoot, type Root } from "react-dom/client"

import App from "./App"
import { ThemeProvider } from "./components/theme-provider"
import "./index.css"

type HistoryRecord = {
  type?: string
  id?: string
  from?: string
  to?: string
  installed_at?: string
  rolled_back_at?: string
  migrations_ran?: boolean
}

const roots = new WeakMap<HTMLElement, Root>()

function historyFrom(element: HTMLElement): HistoryRecord[] {
  try {
    return JSON.parse(element.dataset.history ?? "[]") as HistoryRecord[]
  } catch {
    return []
  }
}

function mountHistory(): void {
  const element = document.getElementById("flex-shadcn-history-root")
  if (!element) return

  let root = roots.get(element)
  if (!root) {
    root = createRoot(element)
    roots.set(element, root)
  }

  root.render(
    <ThemeProvider storageKey="flexcms.admin.theme">
      <App history={historyFrom(element)} csrfToken={element.dataset.csrf ?? ""} />
    </ThemeProvider>,
  )
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountHistory, { once: true })
} else {
  mountHistory()
}

window.addEventListener("flex-admin-content-updated", mountHistory)
