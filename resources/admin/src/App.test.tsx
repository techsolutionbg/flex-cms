import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "@/App"

describe("admin application shell", () => {
  it("renders the dashboard navigation and content", () => {
    render(<App bootstrap={{ page: "dashboard", csrfToken: "token", sidebarWidth: 248, version: "1.0.0" }} />)
    expect(screen.getByRole("heading", { name: "Административен панел" })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Административна навигация" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Табло" })).toHaveAttribute("aria-current", "page")
  })
})
