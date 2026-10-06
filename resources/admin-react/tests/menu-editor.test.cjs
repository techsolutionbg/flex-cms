const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
function editor(id, capabilities) {
  const hooks = [],
    effects = [],
    cleanups = [],
    dependencies = []
  const calls = []
  let cursor = 0,
    root,
    dirty = 0
  const jsx = (type, props) => ({ type, props })
  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in hooks)) hooks[i] = typeof initial === "function" ? initial() : initial
      return [
        hooks[i],
        (value) => {
          hooks[i] = typeof value === "function" ? value(hooks[i]) : value
        },
      ]
    },
    useRef(initial) {
      const i = cursor++
      if (!(i in hooks)) hooks[i] = { current: initial }
      return hooks[i]
    },
    useEffect(effect, deps) {
      const i = cursor++
      if (!dependencies[i] || deps.some((dep, j) => !Object.is(dep, dependencies[i][j]))) {
        dependencies[i] = deps
        effects.push(() => {
          cleanups[i]?.()
          cleanups[i] = effect()
        })
      }
    },
  }
  const record = {
    id: 4,
    name: "Original",
    slug: "original",
    status: "active",
    version: 1,
    items: [],
  }
  const api = {
    menuRequest: async (url, method = "GET", body) => {
      calls.push({ url, method, body })
      return url === "/api/admin/menus" && method === "GET"
        ? {
            theme: "starter",
            menu_locations: { primary: "Main", footer: "Footer" },
            assignments: { primary: 4 },
            assignment_version: "revision",
            menus: [],
            pages: [],
          }
        : { menu: method === "GET" ? record : { ...body, id: 4, version: 2 } }
    },
  }
  const modules = {
    "@/components/loading-button": { LoadingButton: "button" },
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": {},
    sonner: { toast: { error() {}, success() {} } },
    "@/components/admin-shell": { AdminShell: "AdminShell" },
    "@/components/breadcrumbs": { Breadcrumbs: "Breadcrumbs" },
    "@/components/collapsible-section": { CollapsibleSection: "CollapsibleSection" },
    "@/components/confirm-dialog": { ConfirmDialog: "ConfirmDialog" },
    "@/components/dropdown-menu": {
      DropdownMenu: "DropdownMenu",
      DropdownOption: "DropdownOption",
      DropdownChevron: "DropdownChevron",
    },
    "@/components/admin-workspace-context": { useWorkspaceChanged: () => () => dirty++ },
    "@/lib/menu-api": api,
  }
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/pages/menu-editor.tsx"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    {
      exports,
      require: (name) => modules[name],
      AbortController,
      crypto: require("node:crypto").webcrypto,
    },
  )
  const nodes = (value) =>
    !value || typeof value !== "object"
      ? []
      : Array.isArray(value)
        ? value.flatMap(nodes)
        : [value, ...nodes(value.props?.children)]
  const render = () => {
    cursor = 0
    root = exports.MenuEditor({
      id,
      capabilities,
      error: null,
      onLogout() {},
      onNavigate() {},
      loggingOut: false,
      onBack() {},
      onSaved() {},
    })
    while (effects.length) effects.shift()()
    return root
  }
  const inputs = () => nodes(root).filter((node) => node.type === "input")
  render()
  return {
    calls,
    render,
    inputs,
    nodes: () => nodes(root),
    dirty: () => dirty,
    support(value) {
      capabilities = {
        theme: "starter",
        supports: { menus: value },
        menu_locations: { primary: "Main" },
      }
      render()
    },
    async flush() {
      await new Promise((resolve) => setImmediate(resolve))
      render()
    },
  }
}
test("a direct menu editor waits for capabilities then loads the actual form", async () => {
  const h = editor(null, null)
  assert.equal(h.calls.length, 0)
  h.support(true)
  await h.flush()
  assert.equal(h.calls.length, 1)
  assert.equal(h.inputs()[0].props.value, "")
  h.inputs()[0].props.onChange({ target: { value: "Main" } })
  h.render()
  assert.equal(h.inputs()[0].props.value, "Main")
  assert.equal(h.dirty(), 1)
})
test("revoking and restoring theme support preserves unsaved menu fields", async () => {
  const h = editor(4, {
    theme: "starter",
    supports: { menus: true },
    menu_locations: { primary: "Main" },
  })
  await h.flush()
  assert.equal(h.inputs()[0].props.value, "Original")
  h.inputs()[0].props.onChange({ target: { value: "Unsaved draft" } })
  h.render()
  h.support(false)
  assert.equal(h.inputs().length, 0)
  h.support(true)
  await h.flush()
  assert.equal(h.inputs()[0].props.value, "Unsaved draft")
  assert.equal(h.calls.length, 2)
})

test("menu metadata form uses the shared location dropdown and omits item editors", async () => {
  const h = editor(4, { theme: "starter", supports: { menus: true } })
  await h.flush()
  assert.deepEqual(
    h
      .nodes()
      .filter((node) => node.type === "CollapsibleSection")
      .map((node) => node.props.title),
    ["Настройки на менюто"],
  )
  assert.equal(h.inputs().length, 2)
  assert.equal(h.nodes().filter((node) => node.type === "select").length, 0)
  const options = () => h.nodes().filter((node) => node.type === "DropdownOption")
  assert.equal(options()[1].props.selected, true)
  options()[2].props.onClick()
  h.render()
  assert.equal(options()[2].props.selected, true)
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  const request = h.calls.find((call) => call.method === "PUT")
  assert.equal(request.body.placement.location, "footer")
  assert.equal(request.body.placement.theme, "starter")
  assert.equal(request.body.placement.assignment_version, "revision")
  assert.equal("items" in request.body, false)
})
test("saving unchanged location preserves all existing bindings", async () => {
  const h = editor(4, { theme: "starter", supports: { menus: true } })
  await h.flush()
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  const request = h.calls.find((call) => call.method === "PUT")
  assert.equal("placement" in request.body, false)
  assert.equal("items" in request.body, false)
})
test("creating a menu saves the selected location in the same request", async () => {
  const h = editor(null, { theme: "starter", supports: { menus: true } })
  await h.flush()
  h.nodes()
    .filter((node) => node.type === "DropdownOption")[1]
    .props.onClick()
  h.render()
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.equal(h.calls.find((call) => call.method === "POST").body.placement.location, "primary")
})

test("slug is optional and the save button follows the fields inside the form", async () => {
  const h = editor(null, { theme: "starter", supports: { menus: true } })
  await h.flush()
  assert.equal(h.inputs()[0].props.required, true)
  assert.equal(h.inputs()[1].props.required, undefined)
  const form = h.nodes().find((node) => node.type === "form")
  const children = form.props.children
  assert.equal(children[0].type, "fieldset")
  assert.equal(children[1].props.className, "react-form-actions")
  assert.equal(children[1].props.children.type, "button")
  assert.equal(children[1].props.children.props.type, "submit")
  form.props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.equal(h.calls.find((call) => call.method === "POST").body.slug, "")
})

test("menu status uses the shared dropdown and is included in saves", async () => {
  const h = editor(4, { theme: "starter", supports: { menus: true } })
  await h.flush()
  const dropdown = () =>
    h
      .nodes()
      .find((node) => node.type === "DropdownMenu" && node.props.ariaLabel === "Статус на менюто")
  const options = () => dropdown().props.children
  assert.equal(dropdown().props.triggerClassName, "react-form-select")
  assert.deepEqual(
    Array.from(options(), (option) => option.props.children),
    ["Активно", "Неактивно", "Чернова"],
  )
  assert.equal(options()[0].props.selected, true)
  options()[2].props.onClick()
  h.render()
  assert.equal(options()[2].props.selected, true)
  assert.equal(h.dirty(), 1)
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.equal(h.calls.find((call) => call.method === "PUT").body.status, "draft")
  options()[1].props.onClick()
  h.render()
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.equal(h.calls.filter((call) => call.method === "PUT")[1].body.status, "inactive")
})
