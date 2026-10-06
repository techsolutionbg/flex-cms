const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const filePath = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function harness(initial = "/", restored = null) {
  const storageKey = "flex-admin-workspace:v1:/:0"
  const storage = new Map(restored ? [[storageKey, JSON.stringify(restored)]] : [])
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }
  const hooks = [],
    effects = [],
    listeners = {},
    routes = []
  let cursor = 0,
    path = initial,
    confirm = false,
    menusSupported = true
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
    "./confirm-dialog": { ConfirmDialog: "ConfirmDialog" },
    "./admin-workspace-context": { AdminWorkspaceContext: { Provider: "Provider" } },
  }
  const storageExports = {}
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(filePath.join(__dirname, "../src/lib/workspace-storage.ts"), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      },
    ).outputText,
    { exports: storageExports, window: { localStorage } },
  )
  modules["@/lib/workspace-storage"] = storageExports
  for (const [name, exports] of Object.entries({
    "dashboard-page": ["DashboardPage"],
    pages: ["PageForm", "PageSettingsForm", "PagesPage"],
    users: ["UserForm", "UsersPage"],
    "profile-page": ["ProfilePage"],
    "themes-page": ["ThemesPage"],
    "theme-store-page": ["ThemeStorePage"],
    "theme-detail-page": ["ThemeDetailPage"],
    plugins: ["PluginCatalogPage", "PluginDetailPage", "PluginsPage"],
    "updates-page": ["UpdatesPage"],
    "settings-page": ["SettingsPage"],
    "menus-page": ["MenusPage"],
    "menu-editor": ["MenuEditor"],
    "menu-structure-page": ["MenuStructurePage"],
    "media-page": ["MediaPage"],
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
        localStorage,
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
      fetch: async (url) => ({
        ok: true,
        json: async () =>
          url === "/api/admin/theme-capabilities"
            ? {
                theme: "demo",
                supports: { menus: menusSupported },
                menu_locations: menusSupported ? { primary: "Main" } : {},
              }
            : {
                plugins: [{ id: "flex/seo", name: "Flex SEO", status: "active" }],
                pages: [
                  {
                    id: 7,
                    title: "Page seven",
                    content: "Original",
                    slug: "seven",
                    status: "draft",
                  },
                ],
              },
      }),
    },
  )
  function render() {
    cursor = 0
    return exports.AdminWorkspace({ onLogout() {}, loggingOut: false }).props.children
  }
  render()
  effects[0]()
  const panels = () =>
    render()
      .flat()
      .filter((node) => node.type === "Provider")
  const active = () => panels().find((node) => !node.props.children.props.hidden)
  const page = () => active().props.children.props.children.props.children
  return {
    startCapabilities: () => {
      render()
      effects.at(-1)()
    },
    changeThemeSupport: (supported) => {
      menusSupported = supported
      listeners["flex-admin-theme-changed"]()
    },
    stored: () => {
      render()
      effects.findLast((effect) => String(effect).includes("writeWorkspace"))()
      return JSON.parse(storage.get(storageKey))
    },
    panels,
    active,
    page,
    routes,
    workspace: () => active().props.value,
    dialog: () => render().find((node) => node.type === "ConfirmDialog"),
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

test("theme details open from both lists and survive workspace restoration", async () => {
  for (const path of ["/themes", "/theme-store"]) {
    const h = harness(path)
    h.page().props.onDetails("flex-starter")
    assert.equal(h.page().type, "ThemeDetailPage")
    assert.equal(h.page().props.id, "flex-starter")
    assert.equal(h.stored().active, "/themes/flex-starter")
    const restored = harness("/themes/flex-starter", h.stored())
    await restored.flush()
    assert.equal(restored.page().type, "ThemeDetailPage")
    assert.equal(restored.page().props.id, "flex-starter")
    restored.page().props.onBack()
    assert.equal(restored.page().type, "ThemesPage")
  }
})

test("plugin preview opens vendor/name identifiers and survives reload and catalog navigation", async () => {
  const h = harness("/plugins")
  h.page().props.onView({ id: "flex/seo", name: "Flex SEO", status: "active" })
  assert.equal(h.page().type, "PluginDetailPage")
  assert.equal(h.page().props.plugin.id, "flex/seo")
  assert.equal(h.stored().active, "/plugins/flex%2Fseo")
  const restored = harness("/plugins/flex%2Fseo", h.stored())
  await restored.flush()
  assert.equal(restored.page().type, "PluginDetailPage")
  assert.equal(restored.page().props.plugin.id, "flex/seo")
  const catalog = harness("/plugins/catalog")
  catalog.page().props.onView("flex/seo")
  await catalog.flush()
  assert.equal(catalog.page().type, "PluginDetailPage")
  assert.equal(catalog.page().props.plugin.name, "Flex SEO")
})

test("protects dirty tabs when closing or unloading and clears dirty state after saving", () => {
  const h = harness("/pages/create")
  const id = h.active().key
  h.active().props.children.props.onInputCapture({ target: { closest: () => null } })
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
  h.active().props.children.props.onInputCapture({ target: { closest: () => null } })
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

test("restores validated tabs and the active tab from local storage", () => {
  const h = harness("/", {
    version: 1,
    paths: ["/pages", "/profile", "/pages", "https://bad.example", "/api/users"],
    active: "/profile",
  })
  assert.equal(h.panels().length, 2)
  assert.equal(h.page().type, "ProfilePage")
  assert.deepEqual(Array.from(h.stored().paths), ["/pages", "/profile"])
  assert.equal(h.stored().active, "/profile")
})
test("an explicit editor URL overrides a previously active tab", async () => {
  const h = harness("/pages/7/edit", { version: 1, paths: ["/profile"], active: "/profile" })
  await h.flush()
  assert.equal(h.page().type, "PageForm")
  assert.equal(h.panels().length, 2)
})
test("persists navigation without form records or dirty values", () => {
  const h = harness("/pages")
  h.page().props.onEdit({ id: 1, title: "Private title", content: "Secret draft" })
  h.active().props.children.props.onInputCapture({ target: { closest: () => null } })
  const saved = h.stored()
  assert.deepEqual(Array.from(saved.paths), ["/pages", "/pages/1/edit"])
  assert.equal(JSON.stringify(saved).includes("Secret draft"), false)
  assert.equal(JSON.stringify(saved).includes("Private title"), false)
  h.confirm(true)
  h.workspace().close(h.active().key)
  assert.deepEqual(Array.from(h.stored().paths), ["/pages"])
})
test("refresh requires confirmation for a dirty form and remounts only that tab", async () => {
  const h = harness("/pages")
  const listKey = h.active().props.children.props.children.key
  h.page().props.onCreate()
  h.active().props.children.props.onInputCapture({ target: { closest: () => null } })
  const id = h.active().key
  const before = h.active().props.children.props.children.key
  await h.workspace().refresh()
  assert.equal(h.active().props.children.props.children.key, before)
  h.confirm(true)
  await h.workspace().refresh()
  assert.equal(h.active().key, id)
  assert.notEqual(h.active().props.children.props.children.key, before)
  assert.equal(h.workspace().tabs.find((tab) => tab.id === id).dirty, false)
  h.workspace().activate(h.workspace().tabs[0].id)
  assert.equal(h.active().props.children.props.children.key, listKey)
})

test("updates a mounted menus tab immediately when the active theme loses or gains support", async () => {
  const h = harness("/")
  h.startCapabilities()
  await h.flush()
  h.page().props.onNavigate("Менюта")
  assert.equal(h.page().type, "MenusPage")
  assert.equal(h.page().props.capabilities.supports.menus, true)
  const id = h.active().key
  h.changeThemeSupport(false)
  await h.flush()
  assert.equal(h.active().key, id)
  assert.equal(h.page().props.capabilities.supports.menus, false)
  h.changeThemeSupport(true)
  await h.flush()
  assert.equal(h.page().props.capabilities.supports.menus, true)
})

test("menu editors open and restore without the generic hydration spinner", () => {
  const h = harness("/menus")
  h.page().props.onCreate()
  assert.equal(h.page().type, "MenuEditor")
  h.workspace().changed()
  h.page().props.onSaved({ id: 12, name: "Основно", version: 1, items: [] })
  assert.equal(h.page().props.id, 12)
  assert.equal(h.workspace().tabs.find((tab) => tab.id === h.active().key).dirty, false)
  assert.equal(h.stored().active, "/menus/12/edit")
  const restored = harness("/menus/12/edit")
  assert.equal(restored.page().type, "MenuEditor")
  assert.equal(restored.page().props.id, 12)
})

test("media library and independent detail tabs persist without generic hydration", () => {
  const h = harness("/media")
  assert.equal(h.page().type, "MediaPage")
  h.page().props.onOpen({ id: 7, title: "Снимка" })
  assert.equal(h.page().props.id, 7)
  h.workspace().changed()
  assert.equal(h.workspace().tabs.find((tab) => tab.id === h.active().key).dirty, true)
  h.workspace().saved()
  assert.equal(h.stored().active, "/media/7/edit")
  const restored = harness("/media/7/edit")
  assert.equal(restored.page().type, "MediaPage")
  assert.equal(restored.page().props.id, 7)
})

test("media upload opens in its own persisted tab and returns to the library", () => {
  const h = harness("/media")
  h.page().props.onUpload()
  assert.equal(h.page().props.upload, true)
  assert.equal(h.page().props.id, undefined)
  assert.equal(h.stored().active, "/media/upload")
  const restored = harness("/media/upload")
  assert.equal(restored.page().props.upload, true)
  restored.page().props.onBack()
  assert.equal(restored.page().props.upload, false)
  assert.equal(restored.stored().active, "/media")
})

test("search and filters in a media picker do not mark the page form dirty", () => {
  const h = harness("/pages/create")
  const transient = {
    target: { closest: (selector) => (selector === "[data-workspace-transient]" ? {} : null) },
  }
  const panel = h.active().props.children.props
  panel.onInputCapture(transient)
  panel.onChangeCapture(transient)
  panel.onClickCapture(transient)
  assert.equal(h.workspace().tabs.find((tab) => tab.id === h.active().key).dirty, false)
  h.workspace().changed()
  assert.equal(h.workspace().tabs.find((tab) => tab.id === h.active().key).dirty, true)
})

test("closing all clean tabs returns to the dashboard and persists only that tab", () => {
  const h = harness("/pages")
  h.page().props.onNavigate("Профил")
  h.page().props.onNavigate("Медийна библиотека")
  assert.equal(h.panels().length, 3)
  assert.equal(h.workspace().canCloseAll, true)
  h.workspace().closeAll()
  assert.equal(h.dialog().props.open, false)
  assert.equal(h.panels().length, 1)
  assert.equal(h.page().type, "DashboardPage")
  assert.equal(h.workspace().canCloseAll, false)
  assert.equal(h.routes.at(-1), "/")
  assert.deepEqual(h.stored().paths, ["/"])
  assert.equal(h.stored().active, "/")
  const restored = harness("/", h.stored())
  assert.equal(restored.panels().length, 1)
  assert.equal(restored.page().type, "DashboardPage")
})

test("closing all dirty tabs requires one shared confirmation and cancel preserves drafts", () => {
  const h = harness("/pages/create")
  h.workspace().changed()
  const first = h.active().key
  h.page().props.onNavigate("Профил")
  h.workspace().changed()
  const second = h.active().key
  h.workspace().closeAll()
  assert.equal(h.dialog().props.open, true)
  assert.match(h.dialog().props.message, /2 таба/)
  assert.equal(h.panels().length, 2)
  h.dialog().props.onCancel()
  assert.equal(h.dialog().props.open, false)
  assert.equal(h.active().key, second)
  assert.equal(h.workspace().tabs.filter((tab) => tab.dirty).length, 2)
  h.workspace().activate(first)
  assert.equal(h.page().type, "PageForm")
  h.workspace().closeAll()
  h.dialog().props.onConfirm()
  assert.equal(h.panels().length, 1)
  assert.equal(h.page().type, "DashboardPage")
  assert.equal(
    h.workspace().tabs.some((tab) => tab.dirty),
    false,
  )
})
