const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
test("editing a repeated embed replaces only the selected occurrence", () => {
  const original = '[gallery id="8" design="grid"]\nТекст\n[gallery id="8" design="grid"]\n'
  const hooks = [],
    effects = []
  let cursor = 0,
    editor,
    changes = []
  const jsx = (type, props) => ({ type, props })
  const react = {
    useContext: () => ({
      extensionPages: [{ id: "galleries", label: "Галерии", embeddable: true }],
    }),
    useState: (initial) => {
      const i = cursor++
      if (!(i in hooks)) hooks[i] = initial
      return [hooks[i], (v) => (hooks[i] = typeof v === "function" ? v(hooks[i]) : v)]
    },
    useRef: (initial) => {
      const i = cursor++
      if (!(i in hooks)) hooks[i] = { current: i === 0 ? {} : initial }
      return hooks[i]
    },
    useEffect: (fn) => effects.push(fn),
  }
  class Quill {
    static import() {
      return {}
    }
    static register() {}
    constructor() {
      editor = this
      this.text = original
      this.root = {
        innerHTML: original,
        setAttribute() {},
        querySelector() {
          return null
        },
      }
      this.clipboard = { dangerouslyPasteHTML: () => {} }
    }
    getText(index = 0, length) {
      return length === undefined ? this.text.slice(index) : this.text.slice(index, index + length)
    }
    getLength() {
      return this.text.length
    }
    on(_event, fn) {
      this.change = fn
    }
    off() {}
    setSelection() {}
    deleteText(index, length) {
      this.text = this.text.slice(0, index) + this.text.slice(index + length)
      this.root.innerHTML = this.text
      this.change(null, null, "user")
    }
    insertText(index, text) {
      this.text = this.text.slice(0, index) + text + this.text.slice(index)
      this.root.innerHTML = this.text
      this.change(null, null, "user")
    }
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    quill: { __esModule: true, default: Quill },
    "quill/dist/quill.snow.css": {},
    "./media-picker": { MediaPicker: "MediaPicker" },
    "./extension-page": { ExtensionModule: "ExtensionModule" },
    "./ui/button": { Button: "Button" },
    "./admin-workspace-context": { useWorkspaceChanged: () => () => {} },
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
  const render = () => {
    cursor = 0
    return exports.RichTextEditor({ value: original, onChange: (v) => changes.push(v) })
  }
  const all = (tree, predicate) =>
    !tree || typeof tree !== "object"
      ? []
      : Array.isArray(tree)
        ? tree.flatMap((t) => all(t, predicate))
        : [...(predicate(tree) ? [tree] : []), ...all(tree.props?.children, predicate)]
  render()
  effects.forEach((fn) => fn())
  let tree = render()
  const rows = all(tree, (node) => node.props?.className === "rich-text-embedded-item")
  assert.equal(rows.length, 2)
  all(rows[1], (node) => node.type === "Button")[0].props.onClick()
  tree = render()
  const picker = all(tree, (node) => node.type === "ExtensionModule")[0]
  assert.equal(picker.props.initialValue, '[gallery id="8" design="grid"]')
  picker.props.onInsert('[gallery id="9" design="slider"]')
  assert.equal(
    editor.text,
    '[gallery id="8" design="grid"]\nТекст\n[gallery id="9" design="slider"]\n',
  )
  assert.equal(changes.at(-1), editor.text)
})
