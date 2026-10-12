const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

const exportsForTest = {}
const storage = new Map()
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/lib/workspace-storage.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  {
    exports: exportsForTest,
    window: {
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
    },
  },
)

test("plugin editors accept slugs and numeric IDs and retain their active tab after reload", () => {
  for (const id of ["contact", "sales-form", "123"]) {
    const editor = `/extension-pages/flex-contact-forms-forms/${id}/edit`
    assert.equal(exportsForTest.isWorkspacePath(editor), true)
    exportsForTest.writeWorkspace(
      "test",
      ["/extension-pages/flex-contact-forms-forms", editor],
      editor,
    )
    const restored = exportsForTest.readWorkspace("test")
    assert.equal(restored.active, editor)
    assert.equal(restored.paths.includes(editor), true)
  }
})

test("plugin workspace paths reject arbitrary subroutes and traversal", () => {
  for (const suffix of [
    "../edit",
    "contact",
    "contact/edit/extra",
    "contact%2Fother/edit",
    "contact?x/edit",
  ]) {
    assert.equal(
      exportsForTest.isWorkspacePath(`/extension-pages/flex-contact-forms-forms/${suffix}`),
      false,
    )
  }
  assert.equal(
    exportsForTest.isWorkspacePath("/extension-pages/flex-contact-forms-forms/create"),
    true,
  )
  assert.equal(
    exportsForTest.isWorkspacePath("/extension-pages/flex-contact-forms-forms/inbox"),
    true,
  )
  assert.equal(
    exportsForTest.isWorkspacePath(
      "/extension-pages/flex-contact-forms-forms/inbox/submissions/20250101120000-deadbeef01234567",
    ),
    true,
  )
})
