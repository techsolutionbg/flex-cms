const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
function harness() {
  const hooks = [],
    dependencies = [],
    effects = [],
    cleanups = [],
    calls = []
  let cursor = 0,
    root
  const menus = [
    {
      id: 1,
      name: "Основно меню",
      slug: "main",
      version: 1,
      deleted_at: null,
      item_count: 2,
      assignments: [{ theme: "starter", location: "primary" }],
    },
    {
      id: 2,
      name: "Друго меню",
      slug: "other",
      version: 1,
      deleted_at: null,
      item_count: 0,
      assignments: [],
    },
  ]
  const caps = {
    theme: "starter",
    supports: { menus: true },
    menu_locations: { primary: "Основно меню" },
  }
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
    useEffect(effect, deps) {
      const i = cursor++
      if (!dependencies[i] || deps.some((value, j) => !Object.is(value, dependencies[i][j]))) {
        dependencies[i] = deps
        effects.push(() => {
          cleanups[i]?.()
          cleanups[i] = effect()
        })
      }
    },
  }
  const api = {
    menuRequest: async (url, method = "GET", body) => {
      calls.push({ url, method, body })
      if (method === "GET")
        return {
          ...caps,
          menus: menus
            .filter((menu) => Boolean(menu.deleted_at) === url.includes("view=trash"))
            .map((menu) => ({ ...menu })),
        }
      const id = Number(url.split("/")[4]),
        menu = menus.find((menu) => menu.id === id)
      assert.equal(body.version, menu.version)
      if (url.endsWith("/force")) menus.splice(menus.indexOf(menu), 1)
      else {
        menu.deleted_at = method === "POST" ? null : "2026-10-05 12:00:00"
        menu.version++
      }
      return {}
    },
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    sonner: { toast: { success() {} } },
    "@/components/admin-shell": { AdminShell: "AdminShell" },
    "@/components/breadcrumbs": { Breadcrumbs: "Breadcrumbs" },
    "@/components/confirm-dialog": { ConfirmDialog: "ConfirmDialog" },
    "@/components/data-table": { DataTable: "DataTable" },
    "@/components/dropdown-menu": {
      DropdownMenu: "DropdownMenu",
      DropdownOption: "DropdownOption",
      DropdownChevron: "DropdownChevron",
    },
    "@/components/table-actions-menu": { TableActionsMenu: "TableActionsMenu" },
    "@/lib/menu-api": api,
  }
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/pages/menus-page.tsx"), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
    ).outputText,
    { exports, require: (name) => modules[name], AbortController },
  )
  const nodes = (value) =>
    !value || typeof value !== "object"
      ? []
      : Array.isArray(value)
        ? value.flatMap(nodes)
        : [value, ...nodes(value.props?.children)]
  const render = () => {
    cursor = 0
    root = exports.MenusPage({
      capabilities: caps,
      error: null,
      onCreate() {},
      onEdit() {},
      onLogout() {},
      onNavigate() {},
      loggingOut: false,
    })
    while (effects.length) effects.shift()()
    return root
  }
  const table = () => nodes(root).find((node) => node.type === "DataTable").props
  const toolbar = () => nodes(table().toolbar)
  const choose = (label) => {
    toolbar()
      .find((node) => node.type === "DropdownOption" && node.props.children === label)
      .props.onClick()
    render()
  }
  const actions = (row) =>
    nodes(
      table()
        .columns.find((column) => column.key === "actions")
        .render(row),
    ).filter((node) => node.type === "DropdownOption")
  const dialog = () => nodes(root).find((node) => node.type === "ConfirmDialog").props
  render()
  return {
    calls,
    menus,
    render,
    table,
    choose,
    actions,
    dialog,
    toolbar,
    async flush() {
      await new Promise((resolve) => setImmediate(resolve))
      render()
    },
  }
}
test("all actions share the standard style and permanent deletion is only available in trash after confirmation", async () => {
  const h = harness()
  await h.flush()
  const options = h.actions(h.table().data[0])
  assert.deepEqual(
    options.map((node) =>
      Array.isArray(node.props.children) ? node.props.children.join("") : node.props.children,
    ),
    ["Статус: Активно", "Статус: Неактивно", "Статус: Чернова", "Редактирай", "Премести в кошчето"],
  )
  assert.ok(options.every((node) => !node.props.danger))
  options[4].props.onClick()
  await h.flush()
  assert.equal(h.menus[0].deleted_at !== null, true)
  assert.equal(h.calls.find((call) => call.method === "DELETE").url, "/api/admin/menus/1")
  h.choose("Кошче")
  await h.flush()
  const trashOptions = h.actions(h.table().data[0])
  assert.deepEqual(
    trashOptions.map((node) => node.props.children),
    ["Възстанови", "Изтрий завинаги"],
  )
  assert.ok(trashOptions.every((node) => !node.props.danger))
  trashOptions[1].props.onClick()
  h.render()
  assert.equal(h.dialog().open, true)
  assert.equal(h.calls.filter((call) => call.url.endsWith("/force")).length, 0)
  h.dialog().onConfirm()
  await h.flush()
  assert.equal(h.calls.find((call) => call.url.endsWith("/force")).body.version, 2)
  assert.equal(h.table().data.length, 0)
})
test("shared filters search menus and filter unassigned locations; clear resets the filters", async () => {
  const h = harness()
  await h.flush()
  h.toolbar()
    .find((node) => node.type === "input")
    .props.onChange({ target: { value: "ОСНОВНО" } })
  h.render()
  assert.equal(h.table().data.length, 1)
  assert.equal(h.table().data[0].id, 1)
  h.toolbar()
    .find((node) => node.type === "button" && node.props.children === "Изчисти филтрите")
    .props.onClick()
  h.render()
  assert.equal(h.table().data.length, 2)
  h.choose("Без локация")
  assert.equal(h.table().data.length, 1)
  assert.equal(h.table().data[0].id, 2)
  assert.equal(h.table().filterStorageKey, "menus")
  const clear = () =>
    h.toolbar().find((node) => node.type === "button" && node.props.children === "Изчисти филтрите")
      .props
  const count = () =>
    h.toolbar().find((node) => node.props?.className === "react-filter-count").props.children
  clear().onClick()
  h.render()
  assert.equal(clear().disabled, true)
  assert.equal(count(), "Без филтри")
  h.choose("Кошче")
  await h.flush()
  assert.equal(clear().disabled, false)
  assert.equal(count(), "1 приложени филтъра")
  assert.equal(h.table().emptyMessage, "Кошчето е празно.")
  clear().onClick()
  h.render()
  await h.flush()
  assert.equal(clear().disabled, true)
  assert.equal(count(), "Без филтри")
  assert.equal(h.table().data.length, 2)
})
test("restoring a trashed menu returns it to the active view", async () => {
  const h = harness()
  await h.flush()
  h.actions(h.table().data[0])[1].props.onClick()
  await h.flush()
  h.choose("Кошче")
  await h.flush()
  h.actions(h.table().data[0])[0].props.onClick()
  await h.flush()
  const restore = h.calls.find((call) => call.url.endsWith("/restore"))
  assert.equal(restore.method, "POST")
  assert.equal(restore.body.version, 2)
  assert.equal(h.table().data.length, 0)
  h.choose("Активни менюта")
  await h.flush()
  assert.equal(h.table().data.length, 2)
})
