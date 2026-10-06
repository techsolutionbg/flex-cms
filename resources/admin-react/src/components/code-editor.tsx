import Editor, { type OnMount } from "@monaco-editor/react"
import { Braces, Check, Copy, Maximize2, Minimize2, WrapText } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

type CodeEditorProps = {
  value: string
  language?: string
  readOnly?: boolean
  height?: string
  copyLabel?: string
  toolbarContent?: ReactNode
}

export function CodeEditor({
  value,
  language = "json",
  readOnly = true,
  height = "460px",
  copyLabel = "Копирай",
  toolbarContent,
}: CodeEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const [wrapped, setWrapped] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [resizedHeight, setResizedHeight] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("flex-admin-code-editor-height"))
      return saved >= 240 && saved <= 1000 ? saved : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return
    function resize(event: WheelEvent) {
      if (fullscreen || event.deltaY === 0) return
      event.preventDefault()
      event.stopPropagation()
      setResizedHeight((current) => {
        const initial = current ?? (height.endsWith("px") ? parseFloat(height) : 460)
        return Math.min(1000, Math.max(240, initial + (event.deltaY > 0 ? -40 : 40)))
      })
    }
    toolbar.addEventListener("wheel", resize, { passive: false })
    return () => toolbar.removeEventListener("wheel", resize)
  }, [fullscreen, height])

  useEffect(() => {
    if (resizedHeight === null) return
    try {
      localStorage.setItem("flex-admin-code-editor-height", String(resizedHeight))
    } catch {
      /* Resizing remains available when storage is restricted. */
    }
  }, [resizedHeight])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFullscreen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(editorRef.current?.getValue() ?? value)
      setCopied(true)
      toast.success("Данните са копирани.")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Данните не могат да бъдат копирани.")
    }
  }

  function formatCode() {
    const editor = editorRef.current
    if (!editor) return
    try {
      editor.getModel()?.setValue(JSON.stringify(JSON.parse(editor.getValue()), null, 2))
      toast.success("JSON кодът е форматиран.")
    } catch {
      toast.error("JSON кодът не може да бъде форматиран.")
    }
  }

  return (
    <div className={`code-editor-shell${fullscreen ? " is-fullscreen" : ""}`}>
      <div
        className="code-editor-toolbar"
        ref={toolbarRef}
        title={fullscreen ? undefined : "Колелцето на мишката: промяна на височината"}
      >
        <span className="code-editor-language">{language.toUpperCase()}</span>
        {toolbarContent}
        <div className="code-editor-actions">
          <button type="button" onClick={formatCode} title="Форматирай JSON">
            <Braces aria-hidden="true" />
            Форматирай
          </button>
          <button
            type="button"
            onClick={() => setWrapped((current) => !current)}
            title="Пренасяне на редове"
          >
            <WrapText aria-hidden="true" />
            {wrapped ? "Без пренасяне" : "Пренасяй редове"}
          </button>
          <button type="button" onClick={() => void copyCode()} title={copyLabel}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? "Копирано" : copyLabel}
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((current) => !current)}
            title="Цял екран"
          >
            {fullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            {fullscreen ? "Затвори" : "Цял екран"}
          </button>
        </div>
      </div>
      <Editor
        height={
          fullscreen ? "calc(100vh - 54px)" : resizedHeight === null ? height : `${resizedHeight}px`
        }
        language={language}
        theme="vs-dark"
        value={value}
        onMount={(editor) => {
          editorRef.current = editor
        }}
        options={{
          readOnly,
          minimap: { enabled: true },
          automaticLayout: true,
          fontSize: 13,
          tabSize: 2,
          wordWrap: wrapped ? "on" : "off",
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
      {!fullscreen && (
        <label className="code-editor-resize-control">
          <span>Височина</span>
          <input
            type="range"
            min={240}
            max={1000}
            step={20}
            value={resizedHeight ?? (height.endsWith("px") ? parseFloat(height) : 460)}
            onChange={(event) => setResizedHeight(Number(event.target.value))}
            aria-label="Височина на редактора"
          />
          <span>{resizedHeight ?? (height.endsWith("px") ? parseFloat(height) : 460)} px</span>
        </label>
      )}
    </div>
  )
}
