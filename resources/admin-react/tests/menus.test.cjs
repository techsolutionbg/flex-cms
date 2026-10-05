const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
function helpers(fetch) {
  const exports = {}
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/menu-api.ts"), "utf8")
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: () => ({ getCsrfToken: async () => "test-token" }), fetch, AbortSignal },
  )
  return exports
}
const item = (id, parent_id = null) => ({
  id,
  parent_id,
  type: "link",
  label: id,
  url: "/test",
  new_tab: false,
  page_id: null,
})
test("reordering stays within sibling groups and preserves descendants", () => {
  const h = helpers(),
    items = [item("a"), item("child", "a"), item("b")]
  assert.deepEqual(
    Array.from(h.moveItem(items, "a", "b"), (x) => x.id),
    ["child", "b", "a"],
  )
  assert.equal(h.moveItem(items, "a", "child"), items)
  assert.deepEqual(Array.from(h.descendants(items, "a")), ["a", "child"])
})
test("nesting rejects cycles, missing parents and depth beyond three", () => {
  const h = helpers(),
    items = [item("a"), item("b", "a"), item("c", "b"), item("d")]
  assert.equal(h.canParent(items, "a", "c"), false)
  assert.equal(h.canParent(items, "d", "c"), false)
  assert.equal(h.canParent(items, "a", "missing"), false)
  assert.equal(h.canParent(items, "d", "a"), true)
  assert.equal(h.canParent(items, "c", null), true)
  assert.equal(h.canParent(items, "a", "d"), false) // moves its entire subtree to level four
})
test("writes include CSRF and credentials; server conflicts keep their actionable message", async () => {
  let sent
  const h = helpers(async (url, options) => {
    sent = { url, ...options }
    return { ok: false, json: async () => ({ error: { message: "Презаредете преди запис." } }) }
  })
  await assert.rejects(
    h.menuRequest("/api/admin/menus/1", "PUT", { version: 1 }),
    /Презаредете преди запис/,
  )
  assert.equal(sent.headers["X-CSRF-Token"], "test-token")
  assert.equal(sent.credentials, "include")
  assert.equal(sent.cache, "no-store")
  assert.equal(JSON.parse(sent.body).version, 1)
  assert.ok(sent.signal)
})

test("dragging supports nesting, outdenting and exchanging the first two elements", () => {
  const h = helpers()
  const items = [item("a"), item("b"), item("c")]
  const nested = h.placeMenuItem(items, "b", "b", "inside")
  assert.equal(nested.find((entry) => entry.id === "b").parent_id, "a")
  const out = h.placeMenuItem(nested, "b", "b", "outdent")
  assert.equal(out.find((entry) => entry.id === "b").parent_id, null)
  assert.deepEqual(
    Array.from(h.placeMenuItem(items, "a", "b", "after"), (entry) => entry.id),
    ["b", "a", "c"],
  )
  assert.deepEqual(
    Array.from(h.placeMenuItem(items, "b", "a", "before"), (entry) => entry.id),
    ["b", "a", "c"],
  )
  assert.equal(
    h.placeMenuItem(items, "a", "b", "inside").find((entry) => entry.id === "a").parent_id,
    "b",
  )
  assert.equal(h.placeMenuItem(items, "b", "b", "outdent"), items)
})

test("moving a parent moves its full subtree and rejects cycles and excessive depth", () => {
  const h = helpers()
  const items = [
    item("first"),
    item("parent"),
    item("child", "parent"),
    item("grandchild", "child"),
    item("last"),
  ]
  const moved = h.placeMenuItem(items, "parent", "last", "after")
  assert.deepEqual(
    Array.from(moved, (entry) => entry.id),
    ["first", "last", "parent", "child", "grandchild"],
  )
  assert.equal(h.placeMenuItem(items, "parent", "child", "inside"), items)
  assert.equal(h.placeMenuItem(items, "parent", "first", "inside"), items)
  assert.equal(h.placeMenuItem(items, "last", "grandchild", "inside"), items)
  const nested = h.placeMenuItem(items, "last", "child", "inside")
  assert.equal(nested.find((entry) => entry.id === "last").parent_id, "child")
  assert.equal(nested[0].id, "first")
})
