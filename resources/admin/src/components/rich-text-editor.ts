import Quill from "quill"
import "quill/dist/quill.snow.css"

type RichTextEditorState = {
  value: string
  editor: Quill | null
  $refs: Record<string, HTMLElement>
  $watch: (expression: string, callback: (value: string) => void) => void
  init(this: RichTextEditorState): void
}

export function richTextEditorMarkup(model: string, label: string): string {
  return `<div class="rich-text-field"><label class="rich-text-label">${label}</label><div class="rich-text-editor" x-data="richTextEditor" x-modelable="value" x-model="${model}" x-init="init()"><div x-ref="editor"></div></div></div>`
}

export function registerRichTextEditor(Alpine: typeof import("alpinejs").default): void {
  Alpine.data("richTextEditor", () => ({
    value: "",
    editor: null as Quill | null,
    init(this: RichTextEditorState) {
      this.editor = new Quill(this.$refs.editor as HTMLElement, {
        theme: "snow",
        placeholder: "Въведете съдържанието на страницата…",
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ align: [] }],
            ["blockquote", "code-block", "link"],
            ["clean"],
          ],
        },
      })

      if (this.value) this.editor.clipboard.dangerouslyPasteHTML(this.value)

      this.editor.on("text-change", () => {
        if (!this.editor) return
        this.value = this.editor.getText().trim().length > 0 ? this.editor.root.innerHTML : ""
      })

      this.$watch("value", (value: string) => {
        if (!this.editor || value === this.editor.root.innerHTML) return
        this.editor.clipboard.dangerouslyPasteHTML(value || "")
      })
    },
  } as RichTextEditorState))
}
