import { describe, expect, it } from "vitest"

import { pageFormSchema, slugifyPageTitle } from "@/lib/page-validation"

describe("page validation", () => {
  it("generates a URL slug from Bulgarian and Latin page titles", () => {
    expect(slugifyPageTitle(" За нас & Services ")).toBe("за-нас-services")
  })

  it("accepts a page with supported content blocks", () => {
    const result = pageFormSchema.safeParse({
      title: "Начало",
      slug: "nachalo",
      content: "<p>Съдържание</p>",
      blocks: [
        { type: "heading", data: { text: "Добре дошли" } },
        { type: "button", data: { label: "Научи повече", url: "/about" } },
      ],
      parent_id: null,
      status: "draft",
    })

    expect(result.success).toBe(true)
  })

  it("rejects unsupported block types and invalid page status", () => {
    const result = pageFormSchema.safeParse({
      title: "Начало",
      slug: "nachalo",
      content: "",
      blocks: [{ type: "video", data: { url: "/video.mp4" } }],
      parent_id: null,
      status: "archived",
    })

    expect(result.success).toBe(false)
  })
})
