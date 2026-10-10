process.env.TZ = "Europe/Sofia"
const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")

function load() {
  const source = fs.readFileSync(path.join(__dirname, "../src/lib/flex-time.ts"), "utf8")
  const exports = {}
  const module = { exports }
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText,
    { require, exports, module, setInterval: () => 1, clearInterval: () => {}, Intl, Date },
  )
  return module.exports
}

test("strings without a zone are UTC and are shown in the viewer's zone", () => {
  const time = load()
  time.configure({ locale: "bg", dateFormat: "d.m.Y", timeFormat: "H:i" })
  assert.equal(time.formatExact("2026-07-01 21:30:00"), "02.07.2026 00:30", "summer time is UTC+3")
  assert.equal(time.formatExact("2026-01-15 10:00:00"), "15.01.2026 12:00", "winter time is UTC+2")
  assert.equal(time.formatExact("2026-07-01T21:30:00Z"), "02.07.2026 00:30")
  assert.equal(time.formatExact("2026-07-01T21:30:00+03:00"), "01.07.2026 21:30")
  assert.equal(time.formatExact("2026-07-01 21:30:00", "date"), "02.07.2026")
  assert.equal(time.isoUtc("2026-07-01 21:30:00"), "2026-07-01T21:30:00Z")
  assert.equal(time.isoUtc(1791633600), "2026-10-10T12:00:00Z")
  assert.equal(time.formatExact(null), "")
  assert.equal(time.formatExact("not a date"), "")
})

test("relative and full formats use the configured language", () => {
  const time = load()
  time.configure({ locale: "bg" })
  const now = "2026-10-10T12:00:00Z"
  assert.equal(time.formatRelative("2026-10-10 11:55:00", now), "преди 5 минути")
  assert.equal(time.formatRelative("2026-10-12T12:00:00Z", now), "след 2 дена")
  assert.equal(
    time.formatFull("2026-10-10 11:55:00", "datetime", now),
    "10.10.2026 14:55 · преди 5 минути",
  )
  assert.equal(time.formatFull("2026-10-10 11:55:00", "relative", now), "преди 5 минути")
  time.configure({ locale: "en" })
  assert.equal(time.formatRelative("2026-10-10 11:55:00", now), "5 minutes ago")
})

test("PHP formats from the general settings map to Day.js tokens", () => {
  const time = load()
  assert.equal(time.phpFormat("d.m.Y"), "DD[.]MM[.]YYYY")
  assert.equal(time.phpFormat("Y-m-d"), "YYYY[-]MM[-]DD")
  assert.equal(time.phpFormat("g:i A"), "h[:]mm[ ]A")
  assert.equal(time.phpFormat("j \\o\\f F"), "D[ of ]MMMM")
  time.configure({ locale: "en", dateFormat: "m/d/Y", timeFormat: "g:i A" })
  assert.equal(time.formatExact("2026-07-01 21:30:00"), "07/02/2026 12:30 AM")
})

test("enhance fills time elements and keeps them current", () => {
  const time = load()
  time.configure({ locale: "bg", dateFormat: "d.m.Y", timeFormat: "H:i" })
  const element = {
    dataset: { flexTime: "date" },
    isConnected: true,
    textContent: "fallback",
    title: "",
    getAttribute: (name) => (name === "datetime" ? "2026-07-01T21:30:00Z" : null),
  }
  const root = {
    querySelectorAll: (selector) =>
      selector === "time[data-flex-time][datetime]" ? [element] : [],
  }
  assert.equal(time.enhance(root), 1)
  assert.match(element.textContent, /^02\.07\.2026 · преди /)
  assert.match(element.title, /^02\.07\.2026 00:30/)
})
