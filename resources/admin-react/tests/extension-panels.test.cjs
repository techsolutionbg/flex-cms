const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function load(workspace = null) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/components/extension-page.tsx"),
    "utf8",
  )
  const stub = new Proxy({}, { get: (_, name) => (name === "__esModule" ? false : () => null) })
  const react = {
    Component: class {},
    useRef: (value) => ({ current: value }),
    useMemo: (factory) => factory(),
    useContext: () => workspace,
    useState: (value) => [value, () => {}],
    useEffect() {},
    useCallback: (fn) => fn,
    useId: () => "id",
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
      useWorkspaceSaved: () => () => {},
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

test("panel saves run in registration order with the saved record ID", async () => {
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

test("a failing panel does not stop the others and reports its error", async () => {
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

test("panels are filtered by location from the workspace", () => {
  const panels = [
    { id: "flex-seo-meta", location: "page.editor" },
    { id: "flex-seo-score", location: "pages.list.column" },
    { id: "acme-forms", location: "page.editor" },
  ]
  const { useExtensionPanels } = load({ extensionPanels: panels })
  assert.deepEqual(
    useExtensionPanels("page.editor").map((panel) => panel.id),
    ["flex-seo-meta", "acme-forms"],
  )
  assert.deepEqual(useExtensionPanels("settings.tab"), [])
})
