const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const filePath = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function harness(initial = "/") {
  const hooks = [],
    effects = [],
    listeners = {},
    routes = []
  let cursor = 0,
    path = initial,
    confirm = false
  const jsx = (type, props, key) => ({ type, props, key })
  const react = {
    useState(value) {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = typeof value === "function" ? value() : value
      return [
        hooks[index],
        (value) => {
          hooks[index] = typeof value === "function" ? value(hooks[index]) : value
        },
      ]
    },
    useRef(value) {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = { current: value }
      return hooks[index]
    },
    useEffect(fn) {
      effects.push(fn)
    },
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/admin-routes": { adminRoute: () => path, adminUrl: (value) => value },
    "./admin-shell": { AdminShell: "AdminShell" },
    "./admin-workspace-context": { AdminWorkspaceContext: { Provider: "Provider" } },
  }
  for (const [name, exports] of Object.entries({
    "dashboard-page": ["DashboardPage"],
    pages: ["PageForm", "PageSettingsForm", "PagesPage"],
    users: ["UserForm", "UsersPage"],
    "profile-page": ["ProfilePage"],
    "themes-page": ["ThemesPage"],
    "theme-store-page": ["ThemeStorePage"],
    plugins: ["PluginCatalogPage", "PluginDetailPage", "PluginsPage"],
    "updates-page": ["UpdatesPage"],
  }))
    modules["@/pages/" + name] = Object.fromEntries(exports.map((value) => [value, value]))
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(filePath.join(__dirname, "../src/components/admin-workspace.tsx"), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      },
    ).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(modules[name], name)
        return modules[name]
      },
      AbortSignal,
      requestAnimationFrame: (fn) => fn(),
      window: {
        scrollY: 100,
        scrollTo() {},
        confirm: () => confirm,
        addEventListener: (name, fn) => {
          listeners[name] = fn
        },
        removeEventListener() {},
        history: {
          pushState(_state, _title, value) {
            path = value
            routes.push(value)
          },
          replaceState(_state, _title, value) {
            path = value
          },
        },
      },
      fetch: async () => ({
        ok: true,
        json: async () => ({
          pages: [
            { id: 7, title: "Page seven", content: "Original", slug: "seven", status: "draft" },
          ],
        }),
      }),
    },
  )
  function render() {
    cursor = 0
    return exports.AdminWorkspace({ onLogout() {}, loggingOut: false }).props.children
  }
  render()
  effects[0]()
  const panels = () => render()
  const active = () => panels().find((node) => !node.props.children.props.hidden)
  const page = () => active().props.children.props.children.props.children
  return {
    panels,
    active,
    page,
    routes,
    workspace: () => active().props.value,
    confirm(value) {
      confirm = value
    },
    back(value) {
      path = value
      listeners.popstate()
    },
    listeners,
    flush: () => new Promise((resolve) => setImmediate(resolve)),
  }
}

test("opens independent page editors, retains their panel keys and deduplicates navigation", () => {
  const h = harness("/pages")
  h.page().props.onEdit({ id: 1, title: "First", content: "Draft one" })
  const first = h.active().key
  h.page().props.onNavigate("Страници")
  h.page().props.onEdit({ id: 2, title: "Second", content: "Draft two" })
  h.page().props.onNavigate("Профил")
  assert.equal(h.panels().length, 4)
  h.workspace().activate(first)
  assert.equal(h.page().type, "PageForm")
  assert.equal(h.page().props.page.content, "Draft one")
  assert.equal(h.active().key, first)
  assert.equal(h.panels().filter((node) => !node.props.children.props.hidden).length, 1)
  h.page().props.onNavigate("Профил")
  assert.equal(h.panels().length, 4)
})

test("protects dirty tabs when closing or unloading and clears dirty state after saving", () => {
  const h = harness("/pages/create")
  const id = h.active().key
  h.active().props.children.props.onInputCapture()
  assert.equal(h.workspace().tabs[0].dirty, true)
  let prevented = false
  h.listeners.beforeunload({
    preventDefault() {
      prevented = true
    },
  })
  assert.equal(prevented, true)
  h.workspace().close(id)
  assert.equal(h.panels().length, 1)
  h.page().props.onSaved({ id: 3, title: "Saved", content: "Hello" })
  assert.equal(h.workspace().tabs[0].dirty, false)
  assert.equal(h.workspace().tabs[0].path, "/pages/3/edit")
  assert.equal(h.active().key, id)
  h.workspace().close(id)
  assert.equal(h.page().type, "DashboardPage")
})

test("confirms discard and chooses a remaining tab", () => {
  const h = harness("/pages")
  h.page().props.onCreate()
  const id = h.active().key
  h.active().props.children.props.onInputCapture()
  h.confirm(true)
  h.workspace().close(id)
  assert.equal(h.panels().length, 1)
  assert.equal(h.page().type, "PagesPage")
})

test("hydrates an editor on browser back and does not duplicate it", async () => {
  const h = harness("/profile")
  h.back("/pages/7/edit")
  assert.equal(h.page().type, "AdminShell")
  await h.flush()
  assert.equal(h.page().type, "PageForm")
  assert.equal(h.page().props.page.id, 7)
  h.back("/profile")
  h.back("/pages/7/edit")
  assert.equal(h.panels().length, 2)
})
