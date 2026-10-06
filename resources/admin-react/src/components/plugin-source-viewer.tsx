import { useEffect, useMemo, useState } from "react"
import { CodeEditor } from "./code-editor"
import { FileCode2, Folder } from "lucide-react"
import { Button } from "./ui/button"
import { CollapsibleSection } from "./collapsible-section"
import { DropdownChevron, DropdownMenu, DropdownOption } from "./dropdown-menu"

type SourceFolder = {
  name: string
  path: string
  folders: Map<string, SourceFolder>
  files: string[]
}

function sourceTree(files: string[], directories: string[]): SourceFolder {
  const root: SourceFolder = { name: "", path: "", folders: new Map(), files: [] }
  function folder(parts: string[]) {
    let current = root
    for (const name of parts) {
      if (!current.folders.has(name))
        current.folders.set(name, {
          name,
          path: current.path ? `${current.path}/${name}` : name,
          folders: new Map(),
          files: [],
        })
      current = current.folders.get(name)!
    }
    return current
  }
  directories.forEach((directory) => folder(directory.split("/")))
  files.forEach((file) => folder(file.split("/").slice(0, -1)).files.push(file))
  return root
}

function SourceTree({
  node,
  pluginId,
  selected,
  onSelect,
}: {
  node: SourceFolder
  pluginId: string
  selected: string
  onSelect: (path: string) => void
}) {
  return (
    <ul>
      {[...node.folders.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => (
          <li key={child.path}>
            <CollapsibleSection
              title={child.name}
              icon={Folder}
              className="plugin-source-folder"
              storageKey={`plugin:${pluginId}:folder:${child.path}`}
              defaultOpen={false}
            >
              {child.folders.size || child.files.length ? (
                <SourceTree
                  node={child}
                  pluginId={pluginId}
                  selected={selected}
                  onSelect={onSelect}
                />
              ) : (
                <small className="react-field-hint">Няма файлове за преглед.</small>
              )}
            </CollapsibleSection>
          </li>
        ))}
      {[...node.files].sort().map((file) => (
        <li key={file}>
          <Button
            variant="secondary"
            type="button"
            aria-current={file === selected ? "true" : undefined}
            title={file}
            onClick={() => onSelect(file)}
          >
            <FileCode2 size={17} aria-hidden="true" />
            <span>{file.split("/").pop()}</span>
          </Button>
        </li>
      ))}
    </ul>
  )
}

const languages: Record<string, string> = {
  php: "php",
  json: "json",
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  twig: "html",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  sql: "sql",
}

async function sourceRequest(plugin: string, signal: AbortSignal, path?: string) {
  const query = new URLSearchParams({ plugin })
  if (path !== undefined) query.set("path", path)
  const response = await fetch(`/api/admin/plugins/source?${query}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message ?? "Кодът не може да бъде зареден.")
  return body
}

export function PluginSourceViewer({ pluginId }: { pluginId: string }) {
  const [files, setFiles] = useState<string[]>([])
  const [directories, setDirectories] = useState<string[]>([])
  const tree = useMemo(() => sourceTree(files, directories), [files, directories])
  const [path, setPath] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    const abort = new AbortController()
    setFiles([])
    setDirectories([])
    setPath("")
    setError("")
    setLoading(true)
    sourceRequest(pluginId, abort.signal)
      .then((body: { files: string[]; directories: string[] }) => {
        setFiles(body.files)
        setDirectories(body.directories ?? [])
        setPath(body.files.includes("plugin.json") ? "plugin.json" : (body.files[0] ?? ""))
        setLoading(false)
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setError(failure.message)
          setLoading(false)
        }
      })
    return () => abort.abort()
  }, [pluginId])
  useEffect(() => {
    if (!path) return
    const abort = new AbortController()
    setContent("")
    setError("")
    setLoading(true)
    sourceRequest(pluginId, abort.signal, path)
      .then((body: { content: string }) => {
        setContent(body.content)
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure.message)
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [pluginId, path])
  return (
    <div className="plugin-source-viewer">
      <p className="react-field-hint">
        Преглед на изходните файлове без редактиране. Скрити файлове, зависимости и бинарни файлове
        не се показват.
      </p>
      <div className="plugin-source-layout">
        {(files.length > 0 || directories.length > 0) && (
          <nav className="plugin-source-files" aria-label="Файлове на разширението">
            <h3>Файлове</h3>
            <SourceTree node={tree} pluginId={pluginId} selected={path} onSelect={setPath} />
          </nav>
        )}
        <div className="plugin-source-content" aria-busy={loading}>
          {path && <p className="plugin-source-path">{path}</p>}
          {loading && <p role="status">Зареждане на кода…</p>}
          {error && (
            <p className="react-form-error" role="alert">
              {error}
            </p>
          )}
          {path ? (
            <CodeEditor
              value={content}
              language={languages[path.split(".").pop()?.toLowerCase() ?? ""] ?? "plaintext"}
              copyLabel="Копирай кода"
              toolbarContent={
                <DropdownMenu
                  ariaLabel="Избери файл за преглед"
                  triggerVariant="secondary"
                  triggerClassName="plugin-source-file-select"
                  trigger={
                    <>
                      {path}
                      <DropdownChevron />
                    </>
                  }
                >
                  {files.map((file) => (
                    <DropdownOption
                      key={file}
                      selected={file === path}
                      onClick={() => setPath(file)}
                    >
                      {file}
                    </DropdownOption>
                  ))}
                </DropdownMenu>
              }
            />
          ) : (
            <p>Няма изходни файлове за преглед.</p>
          )}
        </div>
      </div>
    </div>
  )
}
