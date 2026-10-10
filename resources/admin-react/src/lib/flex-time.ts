// Platform time standard: the server stores and sends UTC; this module is the only place that turns it into
// the viewer's local time. It is bundled into the admin and published as /assets/flex-time.js for public pages.
import dayjs, { type Dayjs } from "dayjs"
import utc from "dayjs/plugin/utc"
import relativeTime from "dayjs/plugin/relativeTime"
import "dayjs/locale/bg"
import "dayjs/locale/en"

dayjs.extend(utc)
dayjs.extend(relativeTime)

export type TimeValue = string | number | Date | null | undefined
export type TimeStyle = "datetime" | "date" | "relative"
export type TimeConfig = { locale: "bg" | "en"; dateFormat: string; timeFormat: string }

const config: TimeConfig = { locale: "bg", dateFormat: "d.m.Y", timeFormat: "H:i" }
dayjs.locale(config.locale)

// PHP date() characters used by the general settings, mapped to Day.js tokens.
const PHP_TOKENS: Record<string, string> = {
  d: "DD",
  j: "D",
  D: "ddd",
  l: "dddd",
  m: "MM",
  n: "M",
  M: "MMM",
  F: "MMMM",
  Y: "YYYY",
  y: "YY",
  H: "HH",
  G: "H",
  h: "hh",
  g: "h",
  i: "mm",
  s: "ss",
  A: "A",
  a: "a",
}

export function phpFormat(format: string): string {
  let result = ""
  let literal = ""
  const flush = () => {
    if (literal !== "") result += "[" + literal + "]"
    literal = ""
  }
  for (let index = 0; index < format.length; index++) {
    const char = format[index]
    if (char === "\\" && index + 1 < format.length) {
      literal += format[++index]
    } else if (PHP_TOKENS[char]) {
      flush()
      result += PHP_TOKENS[char]
    } else {
      literal += char
    }
  }
  flush()
  return result
}

const ZONELESS = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/

/** Strings without a zone are UTC. Numbers below 10^11 are Unix seconds, larger ones milliseconds. */
export function parse(value: TimeValue): Dayjs | null {
  if (value === null || value === undefined || value === "") return null
  let date: Dayjs
  if (value instanceof Date) date = dayjs(value)
  else if (typeof value === "number") date = value < 1e11 ? dayjs.unix(value) : dayjs(value)
  else {
    const text = value.trim()
    if (/^\d{9,11}$/.test(text)) date = dayjs.unix(Number(text))
    else if (ZONELESS.test(text)) date = dayjs.utc(text.replace(" ", "T")).local()
    else date = dayjs(text)
  }
  return date.isValid() ? date.locale(config.locale) : null
}

export function configure(next: Partial<TimeConfig>): TimeConfig {
  if (next.locale === "bg" || next.locale === "en") config.locale = next.locale
  if (typeof next.dateFormat === "string" && next.dateFormat.trim() !== "")
    config.dateFormat = next.dateFormat
  if (typeof next.timeFormat === "string" && next.timeFormat.trim() !== "")
    config.timeFormat = next.timeFormat
  dayjs.locale(config.locale)
  return { ...config }
}

/** Reads lang, data-flex-date-format and data-flex-time-format from <html>. */
export function configureFromDocument(doc: Document = document): TimeConfig {
  const root = doc.documentElement
  return configure({
    locale: root.lang?.toLowerCase().startsWith("en") ? "en" : "bg",
    dateFormat: root.dataset.flexDateFormat,
    timeFormat: root.dataset.flexTimeFormat,
  })
}

/** Exact local time in the configured format, for example "10.10.2026 14:30". */
export function formatExact(value: TimeValue, style: TimeStyle = "datetime"): string {
  const date = parse(value)
  if (!date) return ""
  const format = style === "date" ? config.dateFormat : config.dateFormat + " " + config.timeFormat
  return date.format(phpFormat(format))
}

/** Relative time, for example "преди 5 минути". */
export function formatRelative(value: TimeValue, now: TimeValue = Date.now()): string {
  const date = parse(value)
  const reference = parse(now) ?? dayjs()
  return date ? date.from(reference) : ""
}

/** The platform standard: "10.10.2026 14:30 · преди 5 минути". */
export function formatFull(
  value: TimeValue,
  style: TimeStyle = "datetime",
  now: TimeValue = Date.now(),
): string {
  if (style === "relative") return formatRelative(value, now)
  const exact = formatExact(value, style)
  return exact === "" ? "" : exact + " · " + formatRelative(value, now)
}

/** ISO 8601 UTC for <time datetime>. */
export function isoUtc(value: TimeValue): string {
  return parse(value)?.utc().format("YYYY-MM-DDTHH:mm:ss[Z]") ?? ""
}

/** The viewer's time zone, shown in tooltips. */
export function zoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ""
  } catch {
    return ""
  }
}

// One shared minute ticker keeps every relative time current without a timer per element.
const listeners = new Set<() => void>()
let ticker: ReturnType<typeof setInterval> | null = null

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (ticker === null)
    ticker = setInterval(() => listeners.forEach((callback) => callback()), 60_000)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && ticker !== null) {
      clearInterval(ticker)
      ticker = null
    }
  }
}

const enhanced = new Set<HTMLElement>()
let unsubscribeEnhanced: (() => void) | null = null

function render(element: HTMLElement): void {
  const value = element.getAttribute("datetime")
  const style = (element.dataset.flexTime || "datetime") as TimeStyle
  const text = formatFull(value, style === "date" || style === "relative" ? style : "datetime")
  if (text === "") return
  element.textContent = text
  const zone = zoneName()
  element.title = formatExact(value, "datetime") + (zone ? " (" + zone + ")" : "")
}

/** Fills every <time data-flex-time datetime="…"> in root (or root itself) and keeps its relative part current. */
export function enhance(root: ParentNode = document): number {
  const selector = "time[data-flex-time][datetime]"
  const self = (root as Element).matches?.(selector) ? [root as HTMLElement] : []
  const elements = [...self, ...Array.from(root.querySelectorAll<HTMLElement>(selector))]
  elements.forEach((element) => {
    render(element)
    enhanced.add(element)
  })
  if (enhanced.size > 0 && unsubscribeEnhanced === null) {
    unsubscribeEnhanced = subscribe(() => {
      enhanced.forEach((element) =>
        element.isConnected ? render(element) : enhanced.delete(element),
      )
      if (enhanced.size === 0 && unsubscribeEnhanced) {
        unsubscribeEnhanced()
        unsubscribeEnhanced = null
      }
    })
  }
  return elements.length
}

/** Configures from <html> and enhances the page now, when the DOM is ready and after page navigation. */
export function autoStart(doc: Document = document): void {
  configureFromDocument(doc)
  const run = () => enhance(doc)
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", run, { once: true })
  else run()
  doc.addEventListener("flex:page-ready", run)
}

export { dayjs }
