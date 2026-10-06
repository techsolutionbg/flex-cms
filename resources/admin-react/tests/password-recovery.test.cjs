const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function harness() {
  const hooks = [],
    calls = [],
    replies = []
  let cursor = 0,
    backed = false
  const jsx = (type, props) => ({ type, props })
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial
      return [
        hooks[index],
        (value) => {
          hooks[index] = typeof value === "function" ? value(hooks[index]) : value
        },
      ]
    },
    useEffect() {},
  }
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "lucide-react": { ArrowLeft: "ArrowLeft", LoaderCircle: "LoaderCircle" },
    "@/components/ui/button": { Button: "Button" },
    "@/components/ui/card": { Card: "Card" },
    "@/components/ui/input": { Input: "Input" },
    "@/components/ui/label": { Label: "Label" },
    "@/lib/admin-api": { getCsrfToken: async () => "csrf" },
  }
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(path.join(__dirname, "../src/pages/password-recovery-page.tsx"), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
      },
    ).outputText,
    {
      exports,
      require: (name) => modules[name],
      AbortSignal,
      window: { setInterval() {}, clearInterval() {} },
      fetch: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body), headers: init.headers })
        const reply = replies.shift()
        assert.ok(reply, "Unexpected request")
        return {
          ok: reply.status < 400,
          status: reply.status,
          json: async () => reply.body,
          headers: { get: () => "60" },
        }
      },
    },
  )
  function tree() {
    cursor = 0
    return exports.PasswordRecoveryPage({
      initialEmail: "admin@example.test",
      onBack: () => {
        backed = true
      },
    })
  }
  function walk(node) {
    if (!node || typeof node !== "object") return []
    if (Array.isArray(node)) return node.flatMap(walk)
    return [node, ...walk(node.props?.children)]
  }
  const nodes = () => walk(tree())
  return {
    calls,
    replies,
    nodes,
    input: (id, value) =>
      nodes()
        .find((n) => n.props?.id === id && n.type === "Input")
        .props.onChange({ target: { value } }),
    submit: () =>
      nodes()
        .find((n) => n.type === "form")
        .props.onSubmit({ preventDefault() {} }),
    text: () => JSON.stringify(tree()),
    backed: () => backed,
  }
}

test("recovery form completes email, code and password steps without storing the grant", async () => {
  const h = harness()
  h.replies.push({ status: 202, body: { message: "Code sent", resend_after: 60 } })
  await h.submit()
  assert.ok(h.nodes().some((n) => n.props?.id === "recovery-code"))
  h.input("recovery-code", "123456")
  h.replies.push({ status: 200, body: { reset_token: "secret-grant" } })
  await h.submit()
  h.input("recovery-password", "new-password-123")
  h.input("recovery-confirmation", "new-password-123")
  h.replies.push({ status: 200, body: { message: "Password changed" } })
  await h.submit()
  assert.equal(h.calls[2].body.reset_token, "secret-grant")
  assert.equal(h.calls[2].headers["X-CSRF-Token"], "csrf")
  assert.ok(!h.nodes().some((n) => n.type === "form"))
  assert.ok(h.text().includes("Password changed"))
})

test("invalid code preserves the verification step and displays the server error", async () => {
  const h = harness()
  h.replies.push({ status: 202, body: { message: "Code sent", resend_after: 60 } })
  await h.submit()
  h.input("recovery-code", "000000")
  h.replies.push({ status: 422, body: { error: { message: "Invalid code" } } })
  await h.submit()
  assert.ok(h.nodes().some((n) => n.props?.id === "recovery-code"))
  assert.ok(h.nodes().some((n) => n.props?.role === "alert"))
  assert.ok(h.text().includes("Invalid code"))
})
