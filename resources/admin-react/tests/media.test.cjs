const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function api() {
  const requests = []
  class XHR {
    constructor() {
      this.upload = {}
      requests.push(this)
    }
    open(method, url) {
      this.method = method
      this.url = url
    }
    setRequestHeader(name, value) {
      ;(this.headers ??= {})[name] = value
    }
    send(data) {
      this.data = data
    }
    abort() {
      this.onabort()
    }
  }
  class Data {
    append(name, value) {
      this[name] = value
    }
  }
  const exports = {}
  const source = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/lib/media-api.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText
  vm.runInNewContext(source, {
    exports,
    require: () => ({ getCsrfToken: async () => "csrf-test" }),
    XMLHttpRequest: XHR,
    FormData: Data,
    AbortSignal,
    DOMException,
    URL,
    console,
  })
  return { ...exports, requests }
}
const ready = () => new Promise((resolve) => setImmediate(resolve))

test("upload reports measured progress and waits for the server result", async () => {
  const client = api(),
    signal = new AbortController(),
    updates = [],
    file = { name: "photo.png" }
  const pending = client.uploadMedia(file, (value) => updates.push(value), signal.signal)
  await ready()
  const xhr = client.requests[0]
  assert.equal(xhr.method, "POST")
  assert.equal(xhr.url, "/api/admin/media")
  assert.equal(xhr.withCredentials, true)
  assert.equal(xhr.headers["X-CSRF-Token"], "csrf-test")
  assert.equal(xhr.data.file, file)
  assert.equal(xhr.headers["Content-Type"], undefined)
  xhr.upload.onprogress({ lengthComputable: true, loaded: 3, total: 4 })
  assert.deepEqual(updates, [75])
  xhr.status = 201
  xhr.responseText = JSON.stringify({ media: { id: 7 } })
  xhr.onload()
  assert.equal((await pending).id, 7)
})

test("cancel and timeout terminate uploads with actionable errors", async () => {
  const client = api(),
    abort = new AbortController()
  const cancelled = client.uploadMedia({ name: "file" }, () => {}, abort.signal)
  await ready()
  abort.abort()
  await assert.rejects(cancelled, { name: "AbortError" })
  const timedOut = client.uploadMedia({ name: "file" }, () => {}, new AbortController().signal)
  await ready()
  client.requests[1].ontimeout()
  await assert.rejects(timedOut, /твърде дълго/)
})

test("oversized responses are shown even when the web server returns HTML", async () => {
  const client = api()
  const pending = client.uploadMedia({ name: "large.mp4" }, () => {}, new AbortController().signal)
  await ready()
  const xhr = client.requests[0]
  xhr.status = 413
  xhr.responseText = "<html>Too large</html>"
  xhr.onload()
  await assert.rejects(pending, /надвишава лимита/)
})

test("an image-only page keeps its HTML and inserts media from the library", () => {
  const changes = [],
    effects = [],
    refs = []
  let editor
  class Quill {
    static import() {
      return {}
    }
    static register() {}
    constructor(_host, options) {
      editor = this
      this.options = options
      this.root = {
        innerHTML: "",
        querySelector: () => (this.root.innerHTML.includes("<img") ? {} : null),
      }
      this.clipboard = { dangerouslyPasteHTML() {} }
    }
    on(_event, handler) {
      this.change = handler
    }
    getText() {
      return "\n"
    }
    getLength() {
      return 1
    }
    insertEmbed(_index, _type, url) {
      this.root.innerHTML = `<p><img src="${url}"></p>`
      this.change(null, null, "user")
    }
    formatText() {}
    setSelection() {}
  }
  const jsx = (type, props) => ({ type, props })
  const modules = {
    react: {
      useState: () => [false, () => {}],
      useRef: (value) => {
        const ref = { current: refs.length === 0 ? {} : value }
        refs.push(ref)
        return ref
      },
      useEffect: (effect) => effects.push(effect),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    quill: { __esModule: true, default: Quill },
    "./media-picker": { MediaPicker: "MediaPicker" },
    "./admin-workspace-context": { useWorkspaceChanged: () => () => {} },
    "quill/dist/quill.snow.css": {},
  }
  const exports = {}
  const source = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../src/components/rich-text-editor.tsx"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText
  vm.runInNewContext(source, { exports, require: (id) => modules[id] })
  const tree = exports.RichTextEditor({ value: "", onChange: (value) => changes.push(value) })
  effects.forEach((effect) => effect())
  const picker = tree.props.children.find((child) => child.type === "MediaPicker")
  picker.props.onSelect({ id: 7, url: "/media-files/7/original", alt: "Снимка" })
  assert.equal(changes.at(-1), '<p><img src="/media-files/7/original"></p>')
  assert.equal(typeof editor.options.modules.toolbar.handlers.image, "function")
})
