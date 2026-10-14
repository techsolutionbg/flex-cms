import { t } from "@/lib/admin-i18n"
import { useContext, useEffect, useRef, useState } from "react"
import { MediaPicker } from "./media-picker"
import {
  AdminWorkspaceContext,
  useWorkspaceChanged,
  useWorkspacePanelActive,
} from "./admin-workspace-context"
import { ExtensionModule, type ExtensionPageDescriptor } from "./extension-page"
import { Button } from "./ui/button"
import Quill from "quill"
import "quill/dist/quill.snow.css"

type RichTextEditorProps = {
  value: string
  onChange: (value: string) => void
  excludeEmbeddableIds?: string[]
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

export function RichTextEditor({
  value,
  onChange,
  excludeEmbeddableIds = [],
}: RichTextEditorProps) {
  const markChanged = useWorkspaceChanged()
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Quill | null>(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  const [pickerOpen, setPickerOpen] = useState(false)
  const insertion = useRef(0)
  const workspace = useContext(AdminWorkspaceContext)
  const panelActive = useWorkspacePanelActive()
  const [embed, setEmbed] = useState<ExtensionPageDescriptor | null>(null)
  const [embeddedItems, setEmbeddedItems] = useState<{ index: number; text: string }[]>([])
  const replacement = useRef<{ index: number; text: string } | null>(null)
  const excludedEmbeddableIds = new Set(excludeEmbeddableIds)
  const embeddablePages = (workspace?.extensionPages ?? []).filter(
    (page) => page.embeddable && !excludedEmbeddableIds.has(page.id),
  )

  function refreshEmbeddedItems(editor: Quill) {
    const text = editor.getText()
    setEmbeddedItems(
      Array.from(text.matchAll(/\[[a-z][a-z0-9_-]*(?:\s+[^\]\r\n]*)?\]/g), (match) => ({
        index: match.index!,
        text: match[0],
      })),
    )
  }

  useEffect(() => {
    valueRef.current = value
    onChangeRef.current = onChange
  }, [value, onChange])

  useEffect(() => {
    if (!panelActive || !hostRef.current) return
    const editor = new Quill(hostRef.current, {
      theme: "snow",
      placeholder: "Въведете съдържанието на страницата…",
      modules: {
        toolbar: {
          container: toolbar,
          handlers: {
            image: () => {
              insertion.current = editor.getSelection()?.index ?? editor.getLength() - 1
              setPickerOpen(true)
            },
          },
        },
      },
    })
    editorRef.current = editor
    editor.root.setAttribute("role", "textbox")
    editor.root.setAttribute("aria-label", "Съдържание")
    editor.root.setAttribute("aria-multiline", "true")
    if (valueRef.current) editor.clipboard.dangerouslyPasteHTML(valueRef.current, "api")
    refreshEmbeddedItems(editor)

    const handleChange = (_delta: unknown, _previous: unknown, source: string) => {
      refreshEmbeddedItems(editor)
      if (source === "user") markChanged?.()
      const html =
        editor.getText().trim().length > 0 || editor.root.querySelector("img,video,iframe")
          ? editor.root.innerHTML
          : ""
      onChangeRef.current(html)
    }
    editor.on("text-change", handleChange)
    const handleSelectionChange = (range: { index: number } | null) => {
      if (range) insertion.current = range.index
    }
    editor.on("selection-change", handleSelectionChange)

    return () => {
      editor.off("text-change", handleChange)
      editor.off("selection-change", handleSelectionChange)
      editor.disable()
      const toolbarElement = (
        editor.getModule("toolbar") as { container?: HTMLElement } | undefined
      )?.container
      toolbarElement?.remove()
      hostRef.current?.replaceChildren()
      editorRef.current = null
    }
  }, [panelActive])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || value === editor.root.innerHTML) return
    editor.clipboard.dangerouslyPasteHTML(value || "", "api")
    refreshEmbeddedItems(editor)
  }, [value])

  return (
    <div className="rich-text-field">
      {embeddablePages.length > 0 && (
        <div className="rich-text-insert-toolbar">
          {embeddablePages.map((page) => (
              <Button
                key={page.id}
                type="button"
                variant="secondary"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  replacement.current = null
                  insertion.current = editorRef.current?.getSelection()?.index ?? insertion.current
                  setEmbed(page)
                }}
              >
                {page.label}
              </Button>
            ))}
        </div>
      )}
      {embed && (
        <ExtensionModule
          descriptor={embed}
          embed
          initialValue={replacement.current?.text ?? ""}
          onClose={() => setEmbed(null)}
          onInsert={(text: string) => {
            const editor = editorRef.current
            if (editor) {
              const item = replacement.current
              if (item) {
                if (editor.getText(item.index, item.text.length) !== item.text) {
                  setEmbed(null)
                  return
                }
                editor.deleteText(item.index, item.text.length, "user")
                editor.insertText(item.index, text, "user")
                editor.setSelection(item.index + text.length, 0)
              } else {
                editor.insertText(insertion.current, `\n${text}\n`, "user")
                editor.setSelection(insertion.current + text.length + 2, 0)
              }
            }
            setEmbed(null)
          }}
        />
      )}
      <div className="rich-text-editor-react">
        <div ref={hostRef} />
      </div>
      {embeddedItems.length > 0 && embeddablePages.length > 0 && (
        <div className="rich-text-embedded-items" aria-label={t("Embedded items")}>
          <span>{t("Embedded items")}</span>
          {embeddedItems.map((item, index) => (
            <div className="rich-text-embedded-item" key={`${item.index}-${item.text}`}>
              <code>{item.text}</code>
              {embeddablePages.map((page) => (
                  <Button
                    key={page.id}
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      replacement.current = item
                      setEmbed(page)
                    }}
                  >

                    {t("Edit")}
                    {embeddablePages.length > 1
                      ? `: ${page.label}`
                      : ""}
                  </Button>
                ))}
            </div>
          ))}
        </div>
      )}
      <MediaPicker
        open={pickerOpen}
        imagesOnly
        onClose={() => setPickerOpen(false)}
        onSelect={(record) => {
          const editor = editorRef.current
          if (!editor) return
          const index = Math.min(insertion.current, editor.getLength() - 1)
          editor.insertEmbed(index, "image", record.url, "user")
          editor.formatText(index, 1, { alt: record.alt }, "user")
          editor.setSelection(index + 1, 0, "silent")
        }}
      />
    </div>
  )
}
