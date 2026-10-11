const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")

function load(storage) {
  const listeners = new Map()
  const window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    addEventListener: (name, callback) => listeners.set(name, [...(listeners.get(name) ?? []), callback]),
    removeEventListener: () => {},
    dispatchEvent: (event) => (listeners.get(event.type) ?? []).forEach((callback) => callback(event)),
  }
  const icon = () => null
  const modules = {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-dom": { createPortal: (node) => node },
    "lucide-react": { CircleHelp: icon, Info: icon, X: icon },
    "./checkbox-field": { CheckboxField: ({ label, checked }) => React.createElement("input", { "aria-label": label, checked, readOnly: true }) },
    "./ui/button": { Button: ({ children, ...props }) => React.createElement("button", props, children) },
  }
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, "../src/components/page-help.tsx"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    { exports, window, document: { body: {} }, Event: class { constructor(type) { this.type = type } }, require: (name) => modules[name] },
  )
  return exports
}

test("inline guidance follows the preference saved by the help dialog", () => {
  const storage = new Map()
  const help = load(storage)
  const hint = () => renderToStaticMarkup(React.createElement(help.Hint, null, "Насока"))
  assert.equal(help.hintsVisible(), true)
  assert.match(hint(), /role="note"/)
  assert.match(hint(), /Насока/)
  help.setHintsVisible(false)
  assert.equal(storage.get("flex-admin-hints"), "0")
  assert.equal(help.hintsVisible(), false)
  assert.equal(hint(), "")
  help.setHintsVisible(true)
  assert.match(hint(), /Насока/)
})

test("the help dialog lists the guidance screens add and offers the preference", () => {
  const help = load(new Map())
  const entries = () => [{ title: "Работа с редактора", content: "Натиснете „/“." }]
  const closed = renderToStaticMarkup(React.createElement(help.PageHelpButton, { entries }))
  assert.match(closed, /Помощ/)
  assert.doesNotMatch(closed, /Работа с редактора/, "entries are read only when the dialog opens")
})
