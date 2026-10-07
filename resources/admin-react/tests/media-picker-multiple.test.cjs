const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function harness(multiple) {
  let selected = [],
    closed = 0
  const selections = [],
    jsx = (type, props) => ({ type, props })
  const react = {
    useState: () => [
      selected,
      (next) => {
        selected = typeof next === "function" ? next(selected) : next
      },
    ],
    useEffect() {},
    useId: () => "picker",
    useRef: () => ({ current: null }),
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-dom": { createPortal: (node) => node },
    "lucide-react": { X: "X" },
    "./ui/button": { Button: "Button" },
    "./media-browser": { MediaBrowser: "MediaBrowser" },
  }
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/components/media-picker.tsx"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    { exports, require: (name) => modules[name], document: { body: {} } },
  )
  const render = () =>
    exports.MediaPicker({
      open: true,
      multiple,
      onSelect: (record) => selections.push(record),
      onSelectMany: (records) => selections.push(records),
      onClose: () => closed++,
    })
  function find(tree, type) {
    if (!tree) return null
    if (Array.isArray(tree)) return tree.map((node) => find(node, type)).find(Boolean)
    return tree.type === type ? tree : find(tree.props?.children, type)
  }
  return { render, find, selections, closed: () => closed }
}

test("multiple picker toggles records without closing and confirms the complete selection", () => {
  const t = harness(true)
  t.find(t.render(), "MediaBrowser").props.onSelect({ id: 1 })
  t.find(t.render(), "MediaBrowser").props.onSelect({ id: 2 })
  assert.equal(t.closed(), 0)
  let tree = t.render()
  assert.deepEqual([...t.find(tree, "MediaBrowser").props.selectedIds], [1, 2])
  t.find(tree, "MediaBrowser").props.onSelect({ id: 1 })
  tree = t.render()
  t.find(tree, "Button").props.onClick()
  assert.equal(t.closed(), 1)
  assert.equal(t.selections[0].length, 1)
  assert.equal(t.selections[0][0].id, 2)
})

test("single picker retains immediate selection and close behavior", () => {
  const t = harness(false)
  t.find(t.render(), "MediaBrowser").props.onSelect({ id: 3 })
  assert.equal(t.selections[0].id, 3)
  assert.equal(t.closed(), 1)
})
