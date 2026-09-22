import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Button } from "@/components/ui/button"

describe("Button", () => {
  it("keeps native button semantics", () => {
    render(<Button type="submit">Запази</Button>)
    expect(screen.getByRole("button", { name: "Запази" })).toHaveAttribute("type", "submit")
  })
})
