// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import { codeEditorMarkup, copyText, formatJson, renderJson } from "@/components/code-editor"

describe("JSON code editor", () => {
  it("formats JSON with readable indentation", () => {
    expect(formatJson({ id: "flex/seo", permissions: ["admin.ui"] })).toBe(`{\n  "id": "flex/seo",\n  "permissions": [\n    "admin.ui"\n  ]\n}`)
  })

  it("renders empty and invalid manifests without throwing", () => {
    expect(formatJson(null)).toBe("{}")
    expect(formatJson("{invalid json")).toBe("{invalid json")
    expect(renderJson("<script>alert('xss')</script>")).not.toContain("<script>")
    expect(renderJson("{invalid json")).toContain("code-editor-line-number")
  })

  it("exposes a copy action in the editor toolbar", () => {
    expect(codeEditorMarkup("pluginDetail?.manifest || {}", "manifest.json")).toContain("@click=\"copy()\"")
    expect(codeEditorMarkup("pluginDetail?.manifest || {}", "manifest.json")).toContain("Копирай")
  })

  it("copies through the fallback when the Clipboard API is unavailable", async () => {
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand })

    await copyText("{\n  \"id\": \"flex/seo\"\n}")

    expect(execCommand).toHaveBeenCalledWith("copy")
  })
})
