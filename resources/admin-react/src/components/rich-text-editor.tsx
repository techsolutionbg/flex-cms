import { useEffect, useRef } from "react"
import { useWorkspaceChanged } from "./admin-workspace-context"
import Quill from "quill"
import "quill/dist/quill.snow.css"

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
}

const Font = Quill.import("formats/font") as { whitelist?: string[] }
Font.whitelist = [
  "sans-serif",
  "serif",
  "monospace",
  "arial",
  "georgia",
  "roboto",
  "inter",
  "times-new-roman",
  "verdana",
]
Quill.register("formats/font", Font, true)

const toolbar = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: Font.whitelist }, { size: ["small", false, "large", "huge"] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }, { script: "sub" }, { script: "super" }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }, { align: [] }],
  ["blockquote", "code-block", "link", "image", "video"],
  ["clean"],
]

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const markChanged = useWorkspaceChanged()
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Quill | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    valueRef.current = value
    onChangeRef.current = onChange
  }, [value, onChange])

  useEffect(() => {
    if (!hostRef.current) return
    const editor = new Quill(hostRef.current, {
      theme: "snow",
      placeholder: "Въведете съдържанието на страницата…",
      modules: { toolbar },
    })
    editorRef.current = editor
    if (valueRef.current) editor.clipboard.dangerouslyPasteHTML(valueRef.current, "api")

    const handleChange = (_delta: unknown, _previous: unknown, source: string) => {
      if (source === "user") markChanged?.()
      const html = editor.getText().trim().length > 0 ? editor.root.innerHTML : ""
      onChangeRef.current(html)
    }
    editor.on("text-change", handleChange)

    return () => {
      editor.off("text-change", handleChange)
      editorRef.current = null
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || value === editor.root.innerHTML) return
    editor.clipboard.dangerouslyPasteHTML(value || "", "api")
  }, [value])

  return (
    <div className="rich-text-editor-react">
      <div ref={hostRef} />
    </div>
  )
}
