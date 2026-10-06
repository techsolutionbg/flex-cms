const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

test("saved panel preferences apply the theme and stop restoring or storing tabs", () => {
  const storage = new Map()
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  }
  const document = { documentElement: { dataset: {} } }
  const window = { localStorage, matchMedia: () => ({ matches: true }) }
  function load(file) {
    const exports = {}
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib", file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, { exports, window, document })
    return exports
  }
  const theme = load("admin-theme.ts")
  const workspace = load("workspace-storage.ts")
  workspace.writeWorkspace("workspace", ["/pages", "/settings"], "/settings")
  assert.equal(workspace.readWorkspace("workspace").active, "/settings")
  theme.applyAdminSettings({ theme: "dark", remember_tabs: "0" })
  assert.equal(document.documentElement.dataset.adminTheme, "dark")
  assert.equal(workspace.readWorkspace("workspace").paths.length, 0)
  workspace.writeWorkspace("workspace", ["/pages"], "/pages")
  assert.equal(storage.has("workspace"), false)
  theme.applyAdminSettings({ theme: "system", remember_tabs: "1" })
  assert.equal(document.documentElement.dataset.adminTheme, "dark")
  workspace.writeWorkspace("workspace", ["/media"], "/media")
  assert.equal(workspace.readWorkspace("workspace").active, "/media")
})
