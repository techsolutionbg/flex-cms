import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { UpdatesPage } from "@/pages/UpdatesPage"
import type { HistoryRecord } from "@/types"

const history: HistoryRecord[] = Array.from({ length: 12 }, (_, index) => ({
  type: "platform",
  id: `release-${index + 1}`,
  from: `1.0.${index}`,
  to: `1.0.${index + 1}`,
  installed_at: new Date(Date.UTC(2026, 0, index + 1, 10)).toISOString(),
  migrations_ran: true,
}))

describe("updates history", () => {
  afterEach(cleanup)

  it("exposes sorting and usable pagination semantics", () => {
    render(
      <UpdatesPage
        bootstrap={{
          page: "updates",
          csrfToken: "token",
          sidebarWidth: 248,
          version: "1.0.0",
          history,
        }}
      />
    )

    expect(
      screen.getByRole("table", {
        name: "История на обновяванията на Flex CMS",
      })
    ).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /Дата/ })).toHaveAttribute(
      "aria-sort",
      "descending"
    )
    expect(screen.getByText("Показване 1–10 от 12")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Страница 2" }))

    expect(screen.getByText("Показване 11–12 от 12")).toBeInTheDocument()
    expect(
      within(screen.getByRole("navigation", { name: "Страници" })).getByRole(
        "button",
        { name: "Страница 2" }
      )
    ).toHaveAttribute("aria-current", "page")
  })

  it("filters the history through the table search field", () => {
    render(
      <UpdatesPage
        bootstrap={{
          page: "updates",
          csrfToken: "token",
          sidebarWidth: 248,
          version: "1.0.0",
          history,
        }}
      />
    )

    fireEvent.change(
      screen.getByRole("textbox", { name: /Търсене в историята/ }),
      {
        target: { value: "release-12" },
      }
    )

    expect(screen.getByText("Показване 1–1 от 1")).toBeInTheDocument()
    expect(screen.getByText("release-12")).toBeInTheDocument()
  })

  it("sorts rows through the ShadCN table header controls", () => {
    render(
      <UpdatesPage
        bootstrap={{
          page: "updates",
          csrfToken: "token",
          sidebarWidth: 248,
          version: "1.0.0",
          history,
        }}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /ID/ }))

    expect(screen.getByText("release-1")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /ID/ })).toHaveAttribute(
      "aria-sort",
      "ascending"
    )
  })
})
