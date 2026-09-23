import Quill from "quill"
import "quill/dist/quill.snow.css"
import { showToast } from "@/components/toast"

type RichTextEditorState = {
  value: string
  editor: Quill | null
  contextMenuOpen: boolean
  contextMenuStyle: string
  hasSelection: boolean
  selection: EditorSelection | null
  $refs: Record<string, HTMLElement>
  $watch: (expression: string, callback: (value: string) => void) => void
  init(this: RichTextEditorState): void
  openContextMenu(this: RichTextEditorState, event: MouseEvent): void
  closeContextMenu(this: RichTextEditorState): void
  copySelection(this: RichTextEditorState, cut?: boolean): Promise<void>
  pasteContent(this: RichTextEditorState, plainText?: boolean): Promise<void>
  selectAllContent(this: RichTextEditorState): void
  clearSelectionFormatting(this: RichTextEditorState): void
  syncEditorValue(this: RichTextEditorState): void
}

type EditorSelection = { index: number; length: number }

function safeEditorSelection(editor: Quill, fallback: EditorSelection | null, focus = false): EditorSelection | null {
  try {
    return editor.getSelection(focus) ?? fallback
  } catch {
    return fallback
  }
}

function safeSetEditorSelection(editor: Quill, index: number, length: number): void {
  try {
    editor.setSelection(index, length, "user")
  } catch {
    editor.root.focus()
  }
}

export function richTextEditorMarkup(model: string, label: string): string {
  return `<div class="rich-text-field"><label class="rich-text-label">${label}</label><div class="rich-text-editor" x-data="richTextEditor" x-modelable="value" x-model="${model}" @contextmenu.prevent.stop="openContextMenu($event)" @click="closeContextMenu"><div x-ref="editor"></div><template x-teleport="body"><div class="rich-text-context-menu" x-show="contextMenuOpen" x-cloak :style="contextMenuStyle" @click.stop @click.outside="closeContextMenu" @keydown.escape.window="closeContextMenu" role="menu"><button type="button" role="menuitem" :disabled="!hasSelection" @click="copySelection()">Копирай</button><button type="button" role="menuitem" :disabled="!hasSelection" @click="copySelection(true)">Изрежи</button><button type="button" role="menuitem" @pointerdown.prevent="pasteContent()">Постави</button><button type="button" role="menuitem" @pointerdown.prevent="pasteContent(true)">Постави като неформатиран текст</button><button type="button" role="menuitem" @click="selectAllContent()">Избери всичко</button><button type="button" role="menuitem" :disabled="!hasSelection" @click="clearSelectionFormatting()">Изчисти форматирането</button></div></template></div></div>`
}

export function registerRichTextEditor(Alpine: typeof import("alpinejs").default): void {
  const Font = Quill.import("formats/font") as { whitelist?: string[] }
  Font.whitelist = ["sans-serif", "serif", "monospace", "arial", "georgia", "roboto", "inter", "times-new-roman", "verdana"]
  Quill.register(Font, true)

  Alpine.data("richTextEditor", () => ({
    value: "",
    editor: null as Quill | null,
    contextMenuOpen: false,
    contextMenuStyle: "",
    hasSelection: false,
    selection: null as EditorSelection | null,
    openContextMenu(this: RichTextEditorState, event: MouseEvent) {
      if (!this.editor) return
      const selection = safeEditorSelection(this.editor, this.selection)
      this.selection = selection
      this.hasSelection = Boolean(selection && selection.length > 0)
      const width = 260
      const estimatedHeight = this.hasSelection ? 286 : 238
      const left = Math.min(event.clientX, window.innerWidth - width - 8)
      const top = event.clientY + estimatedHeight > window.innerHeight ? Math.max(8, event.clientY - estimatedHeight) : event.clientY
      this.contextMenuStyle = `left: ${Math.max(8, left)}px; top: ${top}px; width: ${width}px;`
      this.contextMenuOpen = true
    },
    closeContextMenu(this: RichTextEditorState) {
      this.contextMenuOpen = false
    },
    syncEditorValue(this: RichTextEditorState) {
      if (!this.editor) return
      const hasText = this.editor.getText().trim().length > 0
      this.value = hasText ? this.editor.root.innerHTML : ""
      this.editor.root.classList.toggle("ql-blank", !hasText)
    },
    async copySelection(this: RichTextEditorState, cut = false) {
      if (!this.editor) return
      const range = this.selection ?? safeEditorSelection(this.editor, null)
      if (!range || range.length === 0) return
      const text = this.editor.getText(range.index, range.length)
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        this.editor.setSelection(range)
        document.execCommand("copy")
      }
      if (cut) {
        this.editor.deleteText(range.index, range.length, "user")
        this.syncEditorValue()
      }
      this.closeContextMenu()
    },
    async pasteContent(this: RichTextEditorState, plainText = false) {
      if (!this.editor) return
      const range = this.selection ?? safeEditorSelection(this.editor, null, true) ?? { index: this.editor.getLength(), length: 0 }
      let text = ""
      let html = ""
      try {
        if (!plainText && navigator.clipboard.read) {
          const items = await navigator.clipboard.read()
          const item = items[0]
          if (item?.types.includes("text/html")) html = await (await item.getType("text/html")).text()
          if (!html && item?.types.includes("text/plain")) text = await (await item.getType("text/plain")).text()
        } else {
          text = await navigator.clipboard.readText()
        }
      } catch {
        text = await navigator.clipboard.readText().catch(() => "")
      }
      if (!html && !text) {
        try {
          this.editor.focus()
          if (document.execCommand("paste")) {
            this.syncEditorValue()
            this.closeContextMenu()
            return
          }
        } catch {
          // Some browsers disable execCommand("paste") for security reasons.
        }
        showToast("Браузърът блокира достъпа до clipboard. Разрешете Paste за localhost и опитайте отново.", "error")
        this.closeContextMenu()
        return
      }
      this.editor.focus()
      const index = Math.min(Math.max(0, range.index), Math.max(0, this.editor.getLength() - 1))
      const length = Math.min(range.length, Math.max(0, this.editor.getLength() - index - 1))
      if (length > 0) this.editor.deleteText(index, length, "user")
      const lengthBeforePaste = this.editor.getLength()
      if (html && !plainText) this.editor.clipboard.dangerouslyPasteHTML(index, html, "user")
      else if (text) this.editor.insertText(index, text, "user")
      const insertedLength = Math.max(0, this.editor.getLength() - lengthBeforePaste)
      safeSetEditorSelection(this.editor, Math.min(index + insertedLength, Math.max(0, this.editor.getLength() - 1)), 0)
      this.syncEditorValue()
      this.closeContextMenu()
    },
    selectAllContent(this: RichTextEditorState) {
      if (!this.editor) return
      this.editor.focus()
      safeSetEditorSelection(this.editor, 0, Math.max(0, this.editor.getLength() - 1))
      this.closeContextMenu()
    },
    clearSelectionFormatting(this: RichTextEditorState) {
      if (!this.editor) return
      const range = this.selection ?? safeEditorSelection(this.editor, null)
      if (!range || range.length === 0) return
      this.editor.removeFormat(range.index, range.length, "user")
      this.syncEditorValue()
      this.closeContextMenu()
    },
    init(this: RichTextEditorState) {
      this.editor = new Quill(this.$refs.editor as HTMLElement, {
        theme: "snow",
        placeholder: "Въведете съдържанието на страницата…",
        modules: {
          toolbar: [
            // Заглавия
            [{ header: [1, 2, 3, 4, 5, 6, false] }],
            // Шрифт и размер
            [{ font: Font.whitelist }, { size: ["small", false, "large", "huge"] }],
            // Форматиране на текста
            ["bold", "italic", "underline", "strike"],
            // Цвят и позициониране на текста
            [{ color: [] }, { background: [] }, { script: "sub" }, { script: "super" }],
            // Списъци
            [{ list: "ordered" }, { list: "bullet" }],
            // Отстъп и подравняване
            [{ indent: "-1" }, { indent: "+1" }, { align: [] }],
            // Блокове, линкове и медия
            ["blockquote", "code-block", "link", "image", "video"],
            // Изчистване на форматирането
            ["clean"],
          ],
        },
      })

      this.editor.root.addEventListener("contextmenu", (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        this.openContextMenu(event)
      })
      this.editor.root.closest<HTMLElement>(".rich-text-editor")?.addEventListener("contextmenu", (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        this.openContextMenu(event)
      }, true)

      if (this.value) this.editor.clipboard.dangerouslyPasteHTML(this.value)

      this.editor.on("text-change", () => {
        if (!this.editor) return
        this.syncEditorValue()
      })

      this.editor.on("selection-change", (range) => {
        if (range) this.selection = range
        this.hasSelection = Boolean(range && range.length > 0)
      })

      this.$watch("value", (value: string) => {
        if (!this.editor || value === this.editor.root.innerHTML) return
        this.editor.clipboard.dangerouslyPasteHTML(value || "")
      })
    },
  } as RichTextEditorState))
}
