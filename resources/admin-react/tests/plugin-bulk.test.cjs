const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function load() {
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/plugin-bulk.ts"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports },
  )
  return exports
}

const plugin = (id, status, extra = {}) => ({ id, name: id, version: "1.0.0", description: "", status, ...extra })
// Results come from another vm realm; copy them into local arrays before comparing.
const ids = (plugins) => Array.from(plugins, (item) => item.id)

test("each bulk action applies only to plugins it suits", () => {
  const { bulkTargets } = load()
  const list = [
    plugin("a", "active", { update_available: true }),
    plugin("b", "inactive"),
    plugin("c", "discovered"),
    plugin("d", "installed", { update_available: true }),
    plugin("e", "error"),
  ]
  assert.deepEqual(ids(bulkTargets("install", list)), ["c"])
  assert.deepEqual(ids(bulkTargets("activate", list)), ["b", "d", "e"])
  assert.deepEqual(ids(bulkTargets("deactivate", list)), ["a"])
  assert.deepEqual(ids(bulkTargets("update_remote", list)), ["a", "d"])
  assert.deepEqual(ids(bulkTargets("uninstall", list)), ["e", "d", "b", "a"])
})

test("required plugins come first when activating and last when deactivating", () => {
  const { bulkTargets } = load()
  const requires = (...list) => ({ manifest: { metadata: { requires: list } } })
  const activate = [
    plugin("flex/shipping-bar", "inactive", requires("flex/commerce")),
    plugin("flex/reviews", "inactive", requires("flex/commerce")),
    plugin("flex/commerce", "inactive"),
    plugin("flex/seo", "inactive"),
  ]
  assert.deepEqual(ids(bulkTargets("activate", activate)), ["flex/commerce", "flex/shipping-bar", "flex/reviews", "flex/seo"])
  const deactivate = activate.map((item) => ({ ...item, status: "active" }))
  assert.deepEqual(ids(bulkTargets("deactivate", deactivate)), ["flex/seo", "flex/reviews", "flex/shipping-bar", "flex/commerce"])
})

test("missing requirements and cycles do not break the order", () => {
  const { bulkTargets } = load()
  const list = [
    plugin("a", "inactive", { manifest: { metadata: { requires: ["b", "not-selected"] } } }),
    plugin("b", "inactive", { manifest: { metadata: { requires: ["a"] } } }),
  ]
  assert.deepEqual(ids(bulkTargets("activate", list)).sort(), ["a", "b"])
})
