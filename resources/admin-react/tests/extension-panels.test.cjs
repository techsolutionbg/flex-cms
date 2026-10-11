const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function load(workspace = null) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/components/extension-runtime.tsx"),
    "utf8",
  )
  const stub = new Proxy({}, { get: (_, name) => (name === "__esModule" ? false : () => null) })
  const react = {
    Component: class {},
    createContext: (value) => ({ Provider: "Provider", value }),
    useContext: (context) => (context && context.value !== undefined ? context.value : workspace),
    useRef: (value) => ({ current: value }),
    useMemo: (factory) => factory(),
    useState: (value) => [typeof value === "function" ? value() : value, () => {}],
    useEffect() {},
    useCallback: (fn) => fn,
    createElement: (type, props, ...children) => ({ type, props, children }),
  }
  const modules = {
    react,
    "react/jsx-runtime": {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
      Fragment: "fragment",
    },
    "./admin-workspace-context": {
      AdminWorkspaceContext: {},
      useWorkspaceChanged: () => () => {},
    },
  }
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      require: (name) => modules[name] ?? stub,
      document: {},
      window: {},
      Promise,
      Map,
      Error,
      String,
    },
  )
  return exports
}

test("extension saves run in registration order with the saved record ID", async () => {
  const { usePanelSaves } = load()
  const saves = usePanelSaves()
  const calls = []
  saves.register("a", async ({ id }) => calls.push("a:" + id))
  const unregister = saves.register("b", ({ id }) => calls.push("b:" + id))
  await saves.run({ id: 7 })
  assert.deepEqual(calls, ["a:7", "b:7"])
  unregister()
  await saves.run({ id: 8 })
  assert.deepEqual(calls, ["a:7", "b:7", "a:8"])
})

test("a failing extension does not stop the others and reports its error", async () => {
  const { usePanelSaves } = load()
  const saves = usePanelSaves()
  const calls = []
  saves.register("broken", () => {
    throw new Error("SEO: невалиден адрес")
  })
  saves.register("ok", () => calls.push("ok"))
  await assert.rejects(saves.run({ id: 1 }), /SEO: невалиден адрес/)
  assert.deepEqual(calls, ["ok"])
})

test("extensions are selected by point and slot", () => {
  const extensions = [
    { id: "flex-seo-meta", point: "page.editor", slot: "screen.section" },
    { id: "flex-seo-score", point: "pages.list", slot: "table.column" },
    { id: "flex-seo-edit", point: "pages.list", slot: "table.row-action" },
    { id: "acme-publish", point: "page.editor.publishing", slot: "section.end" },
  ]
  const { useExtensions } = load({ extensions })
  assert.deepEqual(
    useExtensions("pages.list", "table.column").map((item) => item.id),
    ["flex-seo-score"],
  )
  assert.deepEqual(
    useExtensions("page.editor.publishing", "section.end").map((item) => item.id),
    ["acme-publish"],
  )
  assert.equal(useExtensions(undefined, "section.end").length, 0, "Unnamed sections have none.")
  assert.equal(useExtensions("page.editor.basic", "section.end").length, 0)
})

test("icons have names for every icon option", () => {
  const { panelIcon } = load()
  for (const name of ["search", "key", "share", "sliders", "list-checks", "settings"]) {
    assert.equal(typeof panelIcon(name), "function", name)
  }
})
