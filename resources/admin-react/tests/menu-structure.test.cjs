const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function structure({
  pages = [],
  items = [],
  failure = "",
  supported = true,
  saveFailure = "",
} = {}) {
  const hooks = [],
    effects = [],
    calls = [],
    writes = []
  let dirty = 0,
    saved = 0,
    hitId = null
  let cursor = 0,
    root
  const jsx = (type, props) => ({ type, props })
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++
        if (!(index in hooks)) hooks[index] = initial
        return [
          hooks[index],
          (value) => {
            hooks[index] = typeof value === "function" ? value(hooks[index]) : value
          },
        ]
      },
      useRef(initial) {
        const index = cursor++
        if (!(index in hooks)) hooks[index] = { current: initial }
        return hooks[index]
      },
      useEffect(effect) {
        const index = cursor++
        if (!(index in hooks)) {
          hooks[index] = true
          effects.push(effect)
        }
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": {},
    sonner: { toast: { success() {}, error() {} } },
    "@/components/admin-workspace-context": {
      useWorkspaceChanged: () => () => dirty++,
      useWorkspaceSaved: () => () => saved++,
    },
    "@/components/admin-shell": { AdminShell: "AdminShell" },
    "@/components/breadcrumbs": { Breadcrumbs: "Breadcrumbs" },
    "@/components/collapsible-section": { CollapsibleSection: "CollapsibleSection" },
    "@/lib/menu-api": {
      menuRequest: async (url, method = "GET", body) => {
        calls.push(url)
        if (method !== "GET") {
          writes.push(body)
          if (saveFailure) throw new Error(saveFailure)
          return { menu: { ...body, version: body.version + 1 } }
        }
        if (failure) throw new Error(failure)
        return url === "/api/admin/menus"
          ? { pages }
          : {
              menu: {
                id: 4,
                name: "Основно меню",
                slug: "main",
                status: "active",
                version: 1,
                items,
              },
            }
      },
    },
  }
  const exports = {}
  const helperExports = {}
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/lib/menu-api.ts"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports: helperExports, require: () => ({}) },
  )
  modules["@/lib/menu-api"] = { ...helperExports, ...modules["@/lib/menu-api"] }
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/pages/menu-structure-page.tsx"), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      },
    ).outputText,
    {
      exports,
      require: (name) => modules[name],
      AbortController,
      crypto: require("node:crypto").webcrypto,
      document: {
        elementFromPoint: () =>
          hitId
            ? {
                closest: () => ({
                  dataset: { menuItem: hitId },
                  getBoundingClientRect: () => ({ top: 0, height: 60 }),
                }),
              }
            : null,
      },
    },
  )
  const walk = (value) =>
    !value || typeof value !== "object"
      ? []
      : Array.isArray(value)
        ? value.flatMap(walk)
        : [value, ...walk(value.props?.children)]
  const render = () => {
    cursor = 0
    root = exports.MenuStructurePage({
      menuId: 4,
      capabilities: { theme: "starter", supports: { menus: supported } },
      error: null,
      onNavigate() {},
      onLogout() {},
      loggingOut: false,
    })
    while (effects.length) effects.shift()()
  }
  render()
  return {
    calls,
    writes,
    render,
    hit(id) {
      hitId = id
    },
    dirty: () => dirty,
    saved: () => saved,
    nodes: () => walk(root),
    async flush() {
      await new Promise((resolve) => setImmediate(resolve))
      render()
    },
    search(value) {
      walk(root)
        .find((node) => node.type === "input")
        .props.onChange({ target: { value } })
      render()
    },
  }
}

test("structure lists pages of all statuses and searches titles regardless of case", async () => {
  const h = structure({
    pages: [
      { id: 1, title: "Контакти", status: "draft" },
      { id: 2, title: "Начало", status: "published" },
      { id: 3, title: "За нас", status: "inactive" },
      { id: 4, title: "Архив", status: "custom" },
    ],
  })
  assert.equal(h.nodes().find((node) => node.type === "input").props.disabled, true)
  await h.flush()
  assert.deepEqual(h.calls, ["/api/admin/menus", "/api/admin/menus/4"])
  assert.equal(h.nodes().filter((node) => node.type === "li").length, 4)
  assert.ok(h.nodes().some((node) => node.props?.children === "custom"))
  h.search("  КОНТ  ")
  const rows = h.nodes().filter((node) => node.type === "li")
  assert.equal(rows.length, 1)
  assert.equal(rows[0].props.children[0].props.children[1].props.children, "Контакти")
  assert.equal(rows[0].props.children[1].props.children, "Чернова")
  h.search("missing")
  assert.equal(h.nodes().filter((node) => node.type === "li").length, 0)
  assert.ok(
    h.nodes().some((node) => node.props?.children === "Няма страници, съответстващи на търсенето."),
  )
  h.search("")
  assert.equal(h.nodes().filter((node) => node.type === "li").length, 4)
})

test("empty page list and failed requests have distinct messages", async () => {
  const empty = structure()
  await empty.flush()
  assert.ok(
    empty.nodes().some((node) => node.props?.children === "Все още няма създадени страници."),
  )
  const failed = structure({ failure: "Menu not found" })
  await failed.flush()
  assert.ok(
    failed
      .nodes()
      .some((node) => node.props?.role === "alert" && node.props.children === "Menu not found"),
  )
  assert.equal(failed.nodes().filter((node) => node.type === "input").length, 0)
})

test("structure does not fetch pages when the active theme lacks menu support", async () => {
  const h = structure({ supported: false })
  await h.flush()
  assert.equal(h.calls.length, 0)
  assert.equal(h.nodes().filter((node) => node.type === "input").length, 0)
})

test("selected pages become collapsible items with editable attributes and save together", async () => {
  const h = structure({ pages: [{ id: 7, title: "Контакти", status: "draft" }] })
  await h.flush()
  const select = () =>
    h
      .nodes()
      .find(
        (node) =>
          node.type === "input" && node.props["aria-label"] === "Избери страницата Контакти",
      )
  select().props.onChange({ target: { checked: true } })
  h.render()
  const add = () =>
    h
      .nodes()
      .find(
        (node) =>
          node.type === "button" &&
          Array.isArray(node.props.children) &&
          node.props.children[0] === "Добави избраните страници",
      )
  add().props.onClick()
  h.render()
  assert.equal(select().props.checked, false)
  assert.equal(
    h
      .nodes()
      .filter((node) => node.type === "CollapsibleSection" && node.props.title === "Контакти")
      .length,
    1,
  )
  const edit = (label, value) => {
    const field = h
      .nodes()
      .find((node) => node.type === "label" && node.props.children?.[0]?.props?.children === label)
    field.props.children[1].props.onChange({ target: { value } })
    h.render()
  }
  assert.equal(
    h.nodes().find((node) => node.type === "CollapsibleSection" && node.props.title === "Контакти")
      .props.defaultOpen,
    false,
  )
  edit("Текст на линка", "Свържете се с нас")
  edit("SEO title", "Contact title")
  edit("Линк", "/contacts")
  edit("Достъпно име (aria-label)", "Contact us")
  edit("CSS класове", "nav-contact")
  edit("Атрибути на връзката (rel)", "nofollow")
  select().props.onChange({ target: { checked: true } })
  h.render()
  add().props.onClick()
  h.render()
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.equal(h.writes[0].items.length, 1)
  assert.equal(h.writes[0].items[0].page_id, 7)
  assert.equal(h.writes[0].items[0].seo_title, "Contact title")
  assert.equal(h.writes[0].items[0].aria_label, "Contact us")
  assert.equal(h.writes[0].items[0].css_class, "nav-contact")
  assert.equal(h.writes[0].items[0].rel, "nofollow")
  assert.equal(h.writes[0].items[0].label, "Свържете се с нас")
  assert.equal(h.writes[0].items[0].url, "/contacts")
  assert.equal(h.writes[0].version, 1)
  assert.equal(h.saved(), 1)
  assert.ok(h.dirty() > 0)
})

test("failed item saves keep the editable draft visible", async () => {
  const h = structure({
    pages: [{ id: 7, title: "Контакти", status: "published" }],
    saveFailure: "Version conflict",
  })
  await h.flush()
  h.nodes()
    .find((node) => node.type === "input" && node.props.type === "checkbox")
    .props.onChange({ target: { checked: true } })
  h.render()
  h.nodes()
    .find(
      (node) =>
        node.type === "button" &&
        Array.isArray(node.props.children) &&
        node.props.children[0] === "Добави избраните страници",
    )
    .props.onClick()
  h.render()
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.ok(
    h
      .nodes()
      .some((node) => node.props?.role === "alert" && node.props.children === "Version conflict"),
  )
  assert.ok(
    h.nodes().some((node) => node.type === "CollapsibleSection" && node.props.title === "Контакти"),
  )
  assert.equal(h.saved(), 0)
})

test("structure allows every row to move and saves nesting from the movement handle", async () => {
  const h = structure({
    items: [
      { id: "first", parent_id: null, label: "Първи", type: "link", url: "/first", new_tab: false },
      {
        id: "second",
        parent_id: null,
        label: "Втори",
        type: "link",
        url: "/second",
        new_tab: false,
      },
    ],
  })
  await h.flush()
  const handles = () =>
    h
      .nodes()
      .filter(
        (node) => node.type === "button" && node.props.className === "menu-structure-drag-handle",
      )
  assert.equal(handles()[0].props.disabled, false)
  assert.equal(handles()[1].props.disabled, false)
  handles()[1].props.onKeyDown({ key: "ArrowRight", preventDefault() {} })
  h.render()
  assert.equal(
    h.nodes().find((node) => node.props?.["data-menu-item"] === "second").props.style
      .marginInlineStart,
    "1.5rem",
  )
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.equal(h.writes[0].items[1].parent_id, "first")
  handles()[1].props.onKeyDown({ key: "ArrowLeft", preventDefault() {} })
  h.render()
  assert.equal(
    h.nodes().find((node) => node.props?.["data-menu-item"] === "second").props.style
      .marginInlineStart,
    "0rem",
  )
})

test("drag marker previews the actual insertion position and depth before dropping", async () => {
  const h = structure({
    items: [
      { id: "first", parent_id: null, label: "Първи", type: "link", url: "/first", new_tab: false },
      {
        id: "second",
        parent_id: null,
        label: "Втори",
        type: "link",
        url: "/second",
        new_tab: false,
      },
      { id: "third", parent_id: null, label: "Трети", type: "link", url: "/third", new_tab: false },
    ],
  })
  await h.flush()
  const handle = () =>
    h
      .nodes()
      .filter(
        (node) => node.type === "button" && node.props.className === "menu-structure-drag-handle",
      )[1]
  const marker = () =>
    h.nodes().find((node) => node.props?.className === "menu-structure-drop-marker")
  const control = {
    focus() {},
    setPointerCapture() {},
    hasPointerCapture() {
      return true
    },
    releasePointerCapture() {},
  }
  handle().props.onPointerDown({
    button: 0,
    clientX: 10,
    clientY: 30,
    pointerId: 1,
    currentTarget: control,
    preventDefault() {},
  })
  h.hit("second")
  handle().props.onPointerMove({ clientX: 45, clientY: 30 })
  h.render()
  assert.equal(marker().props.style.insetInlineStart, "1.5rem")
  const firstRow = h.nodes().find((node) => node.props?.["data-menu-item"] === "first")
  assert.equal(firstRow.props.children[0].props.className, "menu-structure-drop-marker")
  assert.match(marker().props.children.props.children.join(""), /подменю на „Първи“/)
  assert.equal(
    h.nodes().find((node) => node.props?.["data-menu-item"] === "second").props.style
      .marginInlineStart,
    "0rem",
  )
  handle().props.onPointerUp({ pointerId: 1, currentTarget: control })
  h.render()
  assert.equal(marker(), undefined)
  assert.equal(
    h.nodes().find((node) => node.props?.["data-menu-item"] === "second").props.style
      .marginInlineStart,
    "1.5rem",
  )
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.equal(h.writes[0].items[1].parent_id, "first")
})

test("dragging above the first item previews the start and saves the reversed order", async () => {
  const h = structure({
    items: [
      { id: "first", parent_id: null, label: "Първи", type: "link", url: "/first", new_tab: false },
      {
        id: "second",
        parent_id: null,
        label: "Втори",
        type: "link",
        url: "/second",
        new_tab: false,
      },
    ],
  })
  await h.flush()
  const handles = () =>
    h
      .nodes()
      .filter(
        (node) => node.type === "button" && node.props.className === "menu-structure-drag-handle",
      )
  const control = {
    focus() {},
    setPointerCapture() {},
    hasPointerCapture() {
      return true
    },
    releasePointerCapture() {},
  }
  handles()[1].props.onPointerDown({
    button: 0,
    clientX: 10,
    clientY: 30,
    pointerId: 1,
    currentTarget: control,
    preventDefault() {},
  })
  h.hit("first")
  handles()[1].props.onPointerMove({ clientX: 10, clientY: 10 })
  h.render()
  assert.ok(
    h.nodes().some((node) => node.props?.className === "menu-structure-drop-marker is-before"),
  )
  handles()[1].props.onPointerUp({ pointerId: 1, currentTarget: control })
  h.render()
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.deepEqual(
    Array.from(h.writes[0].items, (item) => item.id),
    ["second", "first"],
  )
  handles()[0].props.onKeyDown({ key: "ArrowDown", preventDefault() {} })
  h.render()
  h.nodes()
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} })
  await h.flush()
  assert.deepEqual(
    Array.from(h.writes[1].items, (item) => item.id),
    ["first", "second"],
  )
})
