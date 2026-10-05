const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
const exported = {}
const jsx = (type, props, key) => ({ type, props, key })
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/components/pagination-controls.tsx"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText,
  {
    exports: exported,
    require: (name) => (name === "react/jsx-runtime" ? { jsx, jsxs: jsx } : {}),
  },
)
function controls(page, totalPages, loading = false) {
  const changes = []
  const root = exported.PaginationControls({
    page,
    totalPages,
    loading,
    onChange: (page) => changes.push(page),
  })
  const flatten = (value) =>
    Array.isArray(value)
      ? value.flatMap(flatten)
      : value && typeof value === "object"
        ? [value, ...flatten(value.props?.children)]
        : []
  const buttons = flatten(root).filter((item) => item.type === "button")
  return {
    buttons,
    changes,
    numbered: buttons.filter((item) => /^Страница /.test(item.props["aria-label"])),
    find: (label) => buttons.find((item) => item.props["aria-label"] === label),
  }
}
test("first page disables start and previous and offers nearby numbers", () => {
  const c = controls(1, 12)
  assert.deepEqual(
    Array.from(c.numbered, (item) => item.props.children),
    [1, 2, 3, 4, 5],
  )
  assert.equal(c.find("Първа страница").props.disabled, true)
  assert.equal(c.find("Предишна страница").props.disabled, true)
  assert.equal(c.find("Страница 1").props["aria-current"], "page")
  assert.equal(c.find("Страница 1").props.disabled, true)
  c.find("Последна страница").props.onClick()
  assert.deepEqual(c.changes, [12])
})
test("middle page has two neighboring pages on either side and all directional controls work", () => {
  const c = controls(6, 12)
  assert.deepEqual(
    Array.from(c.numbered, (item) => item.props.children),
    [4, 5, 6, 7, 8],
  )
  for (const [label, result] of [
    ["Първа страница", 1],
    ["Предишна страница", 5],
    ["Следваща страница", 7],
    ["Последна страница", 12],
    ["Страница 8", 8],
  ]) {
    assert.equal(c.find(label).props.disabled, false)
    c.find(label).props.onClick()
    assert.equal(c.changes.at(-1), result)
  }
})
test("last page disables next and end and keeps nearest numbers", () => {
  const c = controls(12, 12)
  assert.deepEqual(
    Array.from(c.numbered, (item) => item.props.children),
    [8, 9, 10, 11, 12],
  )
  assert.equal(c.find("Следваща страница").props.disabled, true)
  assert.equal(c.find("Последна страница").props.disabled, true)
})
test("one or zero pages and loading disable every control", () => {
  for (const c of [controls(1, 1), controls(1, 0), controls(5, 12, true)])
    assert.ok(c.buttons.every((item) => item.props.disabled))
})
test("out of range page is clamped when a filter reduces the results", () => {
  const c = controls(12, 3)
  assert.equal(c.find("Страница 3").props["aria-current"], "page")
  assert.equal(c.find("Следваща страница").props.disabled, true)
})
