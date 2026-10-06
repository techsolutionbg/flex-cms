const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
function load(file, context) {
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/", file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    { exports, ...context },
  )
  return exports
}

test("request tracker waits for concurrent operations and finishes only once", () => {
  const { createRequestTracker } = load("lib/request-tracker.ts", {})
  const tracker = createRequestTracker(),
    values = []
  const unsubscribe = tracker.subscribe(() => values.push(tracker.snapshot()))
  const first = tracker.begin(),
    second = tracker.begin()
  first()
  first()
  assert.equal(tracker.snapshot(), 1)
  second()
  assert.equal(tracker.snapshot(), 0)
  assert.deepEqual(values, [1, 2, 1, 0])
  unsubscribe()
})

test("fetch errors and XHR abort/send failures always clear global loading", async () => {
  class XHR extends EventTarget {
    send() {
      if (this.fail) throw new Error("send failed")
    }
  }
  const window = {
    fetch: async () => {
      throw new Error("offline")
    },
  }
  const { requestTracker, installRequestTracking } = load("lib/request-tracker.ts", {
    window,
    XMLHttpRequest: XHR,
  })
  installRequestTracking()
  await assert.rejects(window.fetch("/api/test"), /offline/)
  assert.equal(requestTracker.snapshot(), 0)
  const xhr = new XHR()
  xhr.send()
  assert.equal(requestTracker.snapshot(), 1)
  xhr.dispatchEvent(new Event("loadend"))
  assert.equal(requestTracker.snapshot(), 0)
  xhr.fail = true
  assert.throws(() => xhr.send(), /send failed/)
  assert.equal(requestTracker.snapshot(), 0)
})

function browserHarness() {
  const hooks = [],
    requests = []
  let cursor = 0
  const record = {
    id: 1,
    title: "Photo",
    original_name: "photo.png",
    mime: "image/png",
    size: 100,
    alt: "",
    created_at: "2026-10-06 00:00:00",
  }
  const react = {
    useEffect() {},
    useMemo: (fn) => fn(),
    useState(initial) {
      const index = cursor++
      if (!(index in hooks))
        hooks[index] =
          index === 0
            ? { media: [record], permissions: { delete: true }, max_bytes: 1000 }
            : index === 7
              ? false
              : typeof initial === "function"
                ? initial()
                : initial
      return [
        hooks[index],
        (value) => {
          hooks[index] = typeof value === "function" ? value(hooks[index]) : value
        },
      ]
    },
  }
  const modules = {
    react,
    "react/jsx-runtime": {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
      Fragment: "Fragment",
    },
    "lucide-react": { File: "File", Grid2X2: "Grid", List: "List" },
    "./data-table": { DataTable: "DataTable" },
    "./dropdown-menu": {
      DropdownMenu: "DropdownMenu",
      DropdownOption: "DropdownOption",
      DropdownChevron: "Chevron",
    },
    "./table-actions-menu": { TableActionsMenu: "TableActionsMenu" },
    "./pagination-controls": { PaginationControls: "PaginationControls" },
    "./confirm-dialog": { ConfirmDialog: "ConfirmDialog" },
    "./media-uploader": { MediaUploader: "MediaUploader" },
    "@/components/ui/button": { Button: "Button" },
    "@/lib/media-api": {
      mediaSize: () => "100 B",
      mediaRequest: async (...args) => {
        requests.push(args)
        return {}
      },
    },
  }
  const { MediaBrowser } = load("components/media-browser.tsx", {
    require: (name) => modules[name],
    localStorage: { getItem: () => null },
  })
  function render() {
    cursor = 0
    return MediaBrowser({ onSelect() {} })
  }
  function walk(node) {
    if (!node || typeof node !== "object") return []
    if (Array.isArray(node)) return node.flatMap(walk)
    return [node, ...walk(node.props?.children)]
  }
  const nodes = () => walk(render())
  return {
    requests,
    nodes,
    dialog: () => nodes().find((node) => node.type === "ConfirmDialog").props,
  }
}

test("moving media to trash requires confirmation and cancel makes no request", async () => {
  const h = browserHarness()
  const trash = () =>
    h
      .nodes()
      .find(
        (node) => node.type === "DropdownOption" && node.props.children === "Премести в кошчето",
      )
      .props.onClick()
  trash()
  assert.equal(h.requests.length, 0)
  assert.equal(h.dialog().open, true)
  h.dialog().onCancel()
  assert.equal(h.dialog().open, false)
  assert.equal(h.requests.length, 0)
  trash()
  h.dialog().onConfirm()
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0][0], "/api/admin/media/1")
  assert.equal(h.requests[0][1], "DELETE")
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(h.dialog().open, false)
})
