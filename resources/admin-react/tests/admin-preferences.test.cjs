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
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib", file), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText,
      { exports, window, document },
    )
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

test("a theme saved in the profile wins over the panel default after reloading", () => {
  const storage = new Map()
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  }
  const load = () => {
    const document = { documentElement: { dataset: {} } }
    const window = { localStorage, matchMedia: () => ({ matches: false }) }
    const exports = {}
    vm.runInNewContext(
      ts.transpileModule(
        fs.readFileSync(path.join(__dirname, "../src/lib/admin-theme.ts"), "utf8"),
        {
          compilerOptions: { module: ts.ModuleKind.CommonJS },
        },
      ).outputText,
      { exports, window, document },
    )
    return { theme: exports, document }
  }
  let { theme, document } = load()
  theme.setAdminThemeUser(7)
  theme.applyAdminSettings({ theme: "light", remember_tabs: "1" })
  assert.equal(document.documentElement.dataset.adminTheme, "light")
  theme.savePersonalTheme("dark")
  assert.equal(document.documentElement.dataset.adminTheme, "dark")

  // Reload: the session is restored, then the panel default (light) is loaded from the server.
  ;({ theme, document } = load())
  theme.setAdminThemeUser(7)
  theme.applyAdminSettings({ theme: "light", remember_tabs: "1" })
  assert.equal(document.documentElement.dataset.adminTheme, "dark", "The profile choice is kept.")

  // Another user on the same device gets the panel default.
  ;({ theme, document } = load())
  theme.setAdminThemeUser(8)
  theme.applyAdminSettings({ theme: "light", remember_tabs: "1" })
  assert.equal(document.documentElement.dataset.adminTheme, "light")

  // Following the panel default again.
  ;({ theme, document } = load())
  theme.setAdminThemeUser(7)
  theme.applyAdminSettings({ theme: "light", remember_tabs: "1" })
  theme.savePersonalTheme(null)
  assert.equal(document.documentElement.dataset.adminTheme, "light")
  assert.equal(theme.getPersonalTheme(), null)
})
