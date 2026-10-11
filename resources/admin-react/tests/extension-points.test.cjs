const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

const jsx = (type, props, key) => ({ type, props: props ?? {}, key })

function compile(file, runtime) {
  const react = {
    useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
    useMemo: (factory) => factory(),
    useEffect() {},
    useId: () => "id",
    useContext: () => null,
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "lucide-react": new Proxy({}, { get: (_, name) => String(name) }),
    "./pagination-controls": { PaginationControls: "PaginationControls" },
    "./table-actions-menu": { TableActionsMenu: "TableActionsMenu" },
    "./extension-runtime": runtime,
  }
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/components", file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    {
      exports,
      require: (name) => modules[name],
      window: { localStorage: { getItem: () => null, setItem() {} } },
    },
  )
  return exports
}

function all(tree, predicate, found = []) {
  if (!tree || typeof tree !== "object") return found
  if (Array.isArray(tree)) {
    tree.forEach((item) => all(item, predicate, found))
    return found
  }
  if (predicate(tree)) found.push(tree)
  all(tree.props?.children, predicate, found)
  return found
}

function tableRuntime(overrides = {}) {
  return {
    ExtensionComponent: "ExtensionComponent",
    RowExtensionActionsContext: { Provider: "RowActions" },
    useTableExtensions: () => ({
      columns: [
        { key: "extension:flex-seo-score", label: "SEO", render: (row) => "score-" + row.id },
      ],
      rowActions: [{ label: "Редактирай SEO", onSelect() {} }],
      bulkActions: [],
      toolbars: [],
      helpers: {},
      setFilter() {},
      filter: null,
      ...overrides,
    }),
  }
}

const rows = [
  { id: 1, title: "Начало" },
  { id: 2, title: "За нас" },
]
const columns = [
  { key: "title", label: "Заглавие" },
  { key: "actions", label: "Действия", render: () => jsx("TableActionsMenu", { children: "own" }) },
]

test("plugin columns are placed before the actions column", () => {
  const { DataTable } = compile("data-table.tsx", tableRuntime())
  const tree = DataTable({
    data: rows,
    columns,
    rowKey: (row) => row.id,
    extensionPoint: "pages.list",
  })
  const headers = all(tree, (node) => node.type === "th").map(
    (th) => all(th, (node) => node.type === "button")[0].props.children[0],
  )
  assert.deepEqual([...headers], ["Заглавие", "SEO", "Действия"])
  assert.ok(all(tree, (node) => node.props?.children === "score-2").length === 1)
})

test("row actions reach the actions menu of every row, even without an own actions column", () => {
  const runtime = tableRuntime()
  const { DataTable } = compile("data-table.tsx", runtime)
  const withActions = DataTable({
    data: rows,
    columns,
    rowKey: (row) => row.id,
    extensionPoint: "pages.list",
  })
  const providers = all(withActions, (node) => node.type === "RowActions")
  assert.equal(providers.length, 2)
  assert.equal(providers[0].props.value.row.id, 1)
  assert.equal(providers[0].props.value.actions[0].label, "Редактирай SEO")

  const withoutActions = DataTable({
    data: rows,
    columns: [{ key: "title", label: "Заглавие" }],
    rowKey: (row) => row.id,
    extensionPoint: "users.list",
  })
  const headers = all(withoutActions, (node) => node.type === "th").length
  assert.equal(headers, 3, "The plugin column and an actions column for plugin actions are added.")
})

test("bulk actions show for the selected rows and toolbar filters reduce the rows", () => {
  const runs = []
  const { DataTable } = compile(
    "data-table.tsx",
    tableRuntime({
      rowActions: [],
      bulkActions: [
        { label: "Изчисли SEO", run: (selected) => runs.push(selected.map((row) => row.id)) },
      ],
      toolbars: [{ id: "flex-seo-filter" }],
      filter: (row) => row.id === 2,
    }),
  )
  const tree = DataTable({
    data: rows,
    columns,
    rowKey: (row) => row.id,
    extensionPoint: "pages.list",
    selectable: true,
    selectedKeys: new Set([1]),
  })
  const bulk = all(tree, (node) => node.type === "button" && node.props.children === "Изчисли SEO")
  assert.equal(bulk.length, 1)
  bulk[0].props.onClick()
  assert.deepEqual(runs, [[1]])
  assert.equal(
    all(tree, (node) => node.type === "ExtensionComponent").length,
    1,
    "The toolbar extension is shown.",
  )
  assert.equal(
    all(tree, (node) => node.props?.children === "score-1").length,
    0,
    "Filtered rows are hidden.",
  )
  assert.equal(all(tree, (node) => node.props?.children === "score-2").length, 1)
})

test("a table without an extension point works as before", () => {
  const { DataTable } = compile(
    "data-table.tsx",
    tableRuntime({ columns: [], rowActions: [], bulkActions: [], toolbars: [] }),
  )
  const tree = DataTable({ data: rows, columns, rowKey: (row) => row.id })
  assert.equal(all(tree, (node) => node.type === "th").length, 2)
  assert.equal(all(tree, (node) => node.type === "RowActions").length, 0)
})

test("sections show plugin content at the start, at the end and as nested sections", () => {
  const nested = [{ id: "acme-vat", label: "ДДС", icon: "sliders", default_open: false }]
  const { CollapsibleSection } = compile("collapsible-section.tsx", {
    ExtensionSlot: "ExtensionSlot",
    ExtensionComponent: "ExtensionComponent",
    panelIcon: () => "Icon",
    useExtensions: (point, slot) => (point && slot === "section.nested" ? nested : []),
  })
  const tree = CollapsibleSection({
    title: "Публикуване",
    extensionPoint: "page.editor.publishing",
    children: "own fields",
  })
  const inner = all(tree, (node) => node.props?.className === "collapsible-section-body-inner")[0]
  const order = inner.props.children
    .flat()
    .map((child) =>
      typeof child === "string"
        ? child
        : child.type === "ExtensionSlot"
          ? child.props.slot
          : child.props.title,
    )
  assert.deepEqual([...order], ["section.start", "own fields", "section.end", "ДДС"])
  const slot = all(tree, (node) => node.type === "ExtensionSlot")[0]
  assert.equal(slot.props.point, "page.editor.publishing")

  const plain = CollapsibleSection({ title: "Без име", children: "x" })
  const plainSlots = all(plain, (node) => node.type === "ExtensionSlot")
  assert.ok(
    plainSlots.every((node) => node.props.point === undefined),
    "Unnamed sections render no plugin content.",
  )
})
