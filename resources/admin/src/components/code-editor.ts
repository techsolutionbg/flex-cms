import { showToast } from "@/components/toast"

type JsonCodeViewerState = {
  source: string
  rendered: string
  setValue(this: JsonCodeViewerState, value: unknown): void
  copy(this: JsonCodeViewerState): Promise<void>
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character)
}

function highlightJsonLine(line: string): string {
  const tokenPattern = /("(?:\\.|[^"\\])*")|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(?:true|false|null)\b/g
  let output = ""
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(line)) !== null) {
    output += escapeHtml(line.slice(cursor, match.index))
    const token = match[0]
    const isKey = token.startsWith('"') && /^\s*:/.test(line.slice(match.index + token.length))
    const tokenClass = isKey ? "json-token-key" : token.startsWith('"') ? "json-token-string" : /^(true|false)$/.test(token) ? "json-token-boolean" : token === "null" ? "json-token-null" : "json-token-number"
    output += `<span class="${tokenClass}">${escapeHtml(token)}</span>`
    cursor = match.index + token.length
  }

  return output + escapeHtml(line.slice(cursor))
}

export function formatJson(value: unknown): string {
  if (value === null || value === undefined || value === "") return "{}"

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2) ?? "{}"
    } catch {
      return value
    }
  }

  let source: string
  try {
    source = JSON.stringify(value ?? {}, null, 2) ?? "{}"
  } catch {
    source = "{}"
  }

  return source
}

export function renderJson(value: unknown): string {
  const source = formatJson(value)

  return source.split("\n").map((line, index) => `<span class="code-editor-line"><span class="code-editor-line-number" aria-hidden="true">${index + 1}</span><span class="code-editor-line-content">${highlightJsonLine(line) || " "}</span></span>`).join("")
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // HTTP/LAN contexts can reject the modern Clipboard API. Use the fallback below.
    }
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "-9999px"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()
  if (!copied) throw new Error("Clipboard copy failed")
}

export function codeEditorMarkup(model: string, filename = "manifest.json"): string {
  return `<div class="code-editor json-code-editor" x-data="jsonCodeViewer" x-effect="setValue(${model})"><div class="code-editor-toolbar"><span class="code-editor-filename"><span class="code-editor-dot" aria-hidden="true"></span>${filename}</span><button class="button secondary code-editor-copy" type="button" @click="copy()">Копирай</button></div><pre class="code-editor-surface" aria-label="${filename}"><code x-html="rendered"></code></pre></div>`
}

export function registerCodeEditor(Alpine: typeof import("alpinejs").default): void {
  Alpine.data("jsonCodeViewer", () => ({
    source: "{}",
    rendered: renderJson({}),
    setValue(this: JsonCodeViewerState, value: unknown) {
      const source = formatJson(value)
      if (source === this.source) return
      this.source = source
      this.rendered = renderJson(value)
    },
    async copy(this: JsonCodeViewerState) {
      try {
        await copyText(this.source)
        showToast("Manifest данните са копирани.", "success")
      } catch {
        showToast("Manifest данните не можаха да бъдат копирани.", "error")
      }
    },
  }))
}
