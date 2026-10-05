const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

test("catalog updates both cards after installing and activating another theme", async () => {
  const states = []
  let cursor = 0
  let effect
  let response
  const errors = []
  const jsx = (type, props, key) => ({ type, props, key })
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in states)) states[index] = initial
      return [
        states[index],
        (value) => {
          states[index] = typeof value === "function" ? value(states[index]) : value
        },
      ]
    },
    useEffect(fn) {
      effect ??= fn
    },
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": {},
    "@/components/admin-shell": { AdminShell: "AdminShell" },
    "@/components/breadcrumbs": { Breadcrumbs: "Breadcrumbs" },
    "@/components/loading-button": { LoadingButton: "LoadingButton" },
    "@/lib/admin-api": { getCsrfToken: async () => "test-token" },
    sonner: {
      toast: {
        success() {},
        error(message) {
          errors.push(message)
        },
      },
    },
  }
  const context = {
    window: { dispatchEvent() {} },
    Event,
    exports: {},
    require(name) {
      assert.ok(name in modules, name)
      return modules[name]
    },
    fetch: async () => ({ ok: true, json: async () => response }),
  }
  const source = fs.readFileSync(path.join(__dirname, "../src/pages/theme-store-page.tsx"), "utf8")
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    context,
  )
  const render = () => {
    cursor = 0
    return context.exports.ThemeStorePage({
      onLogout() {},
      onNavigate() {},
      onBack() {},
      loggingOut: false,
    })
  }
  const nodes = (root) => {
    if (!root || typeof root !== "object") return []
    if (Array.isArray(root)) return root.flatMap(nodes)
    return [root, ...nodes(root.props?.children)]
  }
  const cards = () => nodes(render()).filter((node) => node.props?.className === "theme-store-card")
  const badge = (card) =>
    nodes(card).find((node) => node.props?.className?.startsWith("react-status-badge")).props
      .className
  const buttons = (card) => nodes(card).filter((node) => node.type === "LoadingButton")
  const flush = () => new Promise((resolve) => setImmediate(resolve))
  response = {
    catalog: [
      { id: "old", name: "Old", version: "1", installed: true, active: true },
      { id: "new", name: "New", version: "1", installed: false, active: false },
    ],
  }
  render()
  effect()
  await flush()
  assert.match(badge(cards()[0]), /status-active$/)
  assert.match(badge(cards()[1]), /status-inactive$/)
  response = {
    themes: [
      { id: "old", version: "1", active: true },
      { id: "new", version: "1", active: false },
    ],
  }
  buttons(cards()[1])[0].props.onClick()
  await flush()
  assert.match(badge(cards()[1]), /status-installed$/)
  for (const id of ["new", "old", "new"]) {
    response = {
      themes: ["old", "new"].map((themeId) => ({
        id: themeId,
        version: "1",
        active: themeId === id,
      })),
    }
    const target = cards().find((card) => card.key === id)
    buttons(target)[0].props.onClick()
    await flush()
    for (const card of cards()) {
      assert.match(badge(card), card.key === id ? /status-active$/ : /status-installed$/)
      assert.equal(buttons(card).length, 2)
    }
  }
  assert.deepEqual(errors, [])
})
