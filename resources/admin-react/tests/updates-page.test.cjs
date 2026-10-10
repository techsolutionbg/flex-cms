const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function compile(file, context) {
  const source = fs.readFileSync(path.join(__dirname, "../src", file), "utf8")
  const exports = {}
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    { ...context, exports },
  )
  return exports
}

function harness(jobs, initialJob = { id: "job-1", type: "platform", status: "pending" }) {
  const states = [],
    effects = [],
    timers = [],
    requests = [],
    errors = [],
    successes = []
  let cursor = 0,
    effectCursor = 0,
    time = Date.now(),
    nextJob = 0
  class Clock extends Date {
    static now() {
      return time
    }
  }
  const jsx = (type, props, key) => ({ type, props, key })
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++
        if (!(index in states)) states[index] = initial
        return [
          states[index],
          (value) => {
            states[index] = typeof value === "function" ? value(states[index]) : value
          },
        ]
      },
      useEffect(fn) {
        effects[effectCursor++] = fn
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": {},
    "@/components/admin-shell": { AdminShell: "AdminShell" },
    "@/components/breadcrumbs": { Breadcrumbs: "Breadcrumbs" },
    "@/components/collapsible-section": { CollapsibleSection: "CollapsibleSection" },
    "@/components/confirm-dialog": { ConfirmDialog: "ConfirmDialog" },
    "@/components/loading-button": { LoadingButton: "LoadingButton" },
    "@/lib/admin-api": { getCsrfToken: async () => "csrf" },
    "@/components/date-time": { DateTime: "DateTime" },
    sonner: {
      toast: { error: (value) => errors.push(value), success: (value) => successes.push(value) },
    },
  }
  const context = {
    Date: Clock,
    AbortSignal,
    window: {
      setTimeout(fn, milliseconds) {
        timers.push(() => {
          time += milliseconds
          fn()
        })
        return timers.length
      },
      clearTimeout() {},
    },
    require(name) {
      assert.ok(name in modules, name)
      return modules[name]
    },
    fetch: async (url, options) => {
      requests.push(url)
      assert.ok(options.signal, "Every monitoring request needs a timeout")
      if (!url.includes("job_id="))
        return {
          ok: true,
          status: 200,
          json: async () => ({ version: "0.1.46", update_jobs: [initialJob] }),
        }
      const item = jobs[Math.min(nextJob++, jobs.length - 1)]
      if (item instanceof Error) throw item
      return {
        ok: !item.httpStatus,
        status: item.httpStatus ?? 200,
        json: async () =>
          item.httpStatus
            ? { error: { message: "Job missing" } }
            : { job: { ...initialJob, ...item } },
      }
    },
  }
  modules["@/lib/update-progress"] = compile("lib/update-progress.ts", context)
  const { UpdatesPage } = compile("pages/updates-page.tsx", context)
  const render = () => {
    cursor = 0
    effectCursor = 0
    return UpdatesPage({ onLogout() {}, onNavigate() {}, loggingOut: false })
  }
  const nodes = (root) => {
    if (!root || typeof root !== "object") return []
    if (Array.isArray(root)) return root.flatMap(nodes)
    return [root, ...nodes(root.props?.children)]
  }
  const flush = () => new Promise((resolve) => setImmediate(resolve))
  const start = async () => {
    render()
    effects[0]()
    await flush()
    render()
    effects[1]()
    await flush()
  }
  const advance = async () => {
    assert.ok(timers.length)
    timers.shift()()
    await flush()
  }
  const progress = () => nodes(render()).find((node) => node.type === "progress")
  return { start, advance, progress, errors, successes, requests, timers }
}

test("resumes a queued update, shows actual stages and stops after completion", async () => {
  const h = harness([
    { status: "running", phase: "downloading" },
    { status: "running", phase: "staged" },
    { status: "completed", phase: "completed" },
  ])
  await h.start()
  assert.equal(h.progress().props.value, 2)
  await h.advance()
  assert.equal(h.progress().props.value, 4)
  await h.advance()
  assert.equal(h.progress(), undefined)
  assert.equal(h.timers.length, 0)
  assert.equal(h.successes.length, 1)
  assert.equal(h.errors.length, 0)
})

test("stops with the worker error when installation fails", async () => {
  const h = harness([{ status: "failed", error: "Signature invalid" }])
  await h.start()
  assert.equal(h.progress(), undefined)
  assert.ok(h.errors.includes("Signature invalid"))
  assert.equal(h.timers.length, 0)
})

test("a worker that never claims a queued job cannot spin forever", async () => {
  const h = harness([{ status: "pending" }], {
    id: "job-1",
    type: "platform",
    status: "pending",
    created_at: new Date(Date.now() - 180_000).toISOString(),
  })
  await h.start()
  assert.equal(h.progress(), undefined)
  assert.match(h.errors[0], /Updater/)
  assert.equal(h.timers.length, 0)
})

test("a missing job stops monitoring instead of retrying forever", async () => {
  const h = harness([{ httpStatus: 404 }])
  await h.start()
  assert.equal(h.progress(), undefined)
  assert.equal(h.errors[0], "Job missing")
  assert.equal(h.timers.length, 0)
})

test("an unreachable server has a bounded reconnect period", async () => {
  const h = harness([new Error("offline")])
  await h.start()
  let attempts = 0
  while (h.timers.length && attempts++ < 50) await h.advance()
  assert.ok(attempts < 50)
  assert.equal(h.progress(), undefined)
  assert.match(h.errors[0], /Връзката/)
})

test("file counts advance the bar within a phase", async () => {
  const h = harness([
    { status: "running", phase: "staged", files_processed: 250, files_total: 1000 },
    { status: "completed" },
  ])
  await h.start()
  assert.equal(h.progress().props.value, 4.25)
  await h.advance()
  assert.equal(h.progress(), undefined)
})

test("rollback jobs are resumed and reach a terminal state", async () => {
  const h = harness([{ status: "completed" }], {
    id: "rollback-1",
    type: "platform_rollback",
    status: "pending",
  })
  await h.start()
  assert.equal(h.successes.length, 1)
  assert.equal(h.timers.length, 0)
})
