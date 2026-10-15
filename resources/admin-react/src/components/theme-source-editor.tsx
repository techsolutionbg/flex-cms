import { t } from "@/lib/admin-i18n"
import { getCsrfToken } from "@/lib/admin-api"
import { useEffect, useMemo, useState } from "react"
import { CodeEditor } from "@/components/code-editor"
import { Button } from "@/components/ui/button"
import { CollapsibleSection } from "@/components/collapsible-section"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { FileCode2, Folder, Image as ImageIcon, Save } from "lucide-react"
import { toast } from "sonner"

type SourceFolder = {
  name: string
  path: string
  folders: Map<string, SourceFolder>
  files: string[]
}

type DocumentDraft = { baseline: string; draft: string }

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

const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "tif", "tiff", "svg"])

function isImageFile(path: string) {
  return imageExtensions.has(path.split(".").pop()?.toLowerCase() ?? "")
}

function imagePreviewUrl(theme: string, path: string) {
  const query = new URLSearchParams({ theme, path })
  return `/api/admin/themes/source/image?${query}`
}

function ThemeTree({
  node,
  themeId,
  selected,
  onSelect,
}: {
  node: SourceFolder
  themeId: string
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
              storageKey={`theme:${themeId}:folder:${child.path}`}
              defaultOpen={false}
            >
              {child.folders.size || child.files.length ? (
                <ThemeTree node={child} themeId={themeId} selected={selected} onSelect={onSelect} />
              ) : (
                <small className="react-field-hint">{t("No files to preview.")}</small>
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
            {isImageFile(file) ? <ImageIcon size={17} aria-hidden="true" /> : <FileCode2 size={17} aria-hidden="true" />}
            <span>{file.split("/").pop()}</span>
          </Button>
        </li>
      ))}
    </ul>
  )
}

const languages: Record<string, string> = {
  php: "php", json: "json", js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  css: "css", scss: "scss", sass: "scss", less: "less", html: "html", twig: "html", xml: "xml",
  svg: "xml", yaml: "yaml", yml: "yaml", md: "markdown", txt: "plaintext", sql: "sql",
}

async function themeSourceRequest(theme: string, signal: AbortSignal, path?: string) {
  const query = new URLSearchParams({ theme })
  if (path !== undefined) query.set("path", path)
  const response = await fetch(`/api/admin/themes/source?${query}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error?.message ?? t("Theme files could not be loaded."))
  return body
}

export function ThemeSourceEditor({
  themeId,
  onUnsavedChangesChange,
}: {
  themeId: string
  onUnsavedChangesChange: (dirty: boolean) => void
}) {
  const [files, setFiles] = useState<string[]>([])
  const [directories, setDirectories] = useState<string[]>([])
  const tree = useMemo(() => sourceTree(files, directories), [files, directories])
  const [path, setPath] = useState("")
  const [documents, setDocuments] = useState<Record<string, DocumentDraft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [imageError, setImageError] = useState(false)
  const document = documents[path]

  function openFile(file: string) {
    setError("")
    setImageError(false)
    setPath(file)
  }

  useEffect(() => {
    onUnsavedChangesChange(Object.values(documents).some((item) => item.draft !== item.baseline))
  }, [documents, onUnsavedChangesChange])

  useEffect(() => {
    const abort = new AbortController()
    setFiles([])
    setDirectories([])
    setPath("")
    setDocuments({})
    setError("")
    setLoading(true)
    themeSourceRequest(themeId, abort.signal)
      .then((body: { files: string[]; directories: string[] }) => {
        setFiles(body.files ?? [])
        setDirectories(body.directories ?? [])
        const initial = (body.files ?? []).includes("theme.json") ? "theme.json" : (body.files?.[0] ?? "")
        setPath(initial)
        setLoading(false)
      })
      .catch((failure) => {
        if (!abort.signal.aborted) {
          setError(failure instanceof Error ? failure.message : t("Theme files could not be loaded."))
          setLoading(false)
        }
      })
    return () => abort.abort()
  }, [themeId])

  useEffect(() => {
    if (!path) return
    if (isImageFile(path)) {
      setLoading(false)
      setError("")
      return
    }
    if (documents[path]) return
    const abort = new AbortController()
    setError("")
    setLoading(true)
    themeSourceRequest(themeId, abort.signal, path)
      .then((body: { content: string }) => {
        setDocuments((current) => current[path] ? current : {
          ...current,
          [path]: { baseline: body.content, draft: body.content },
        })
      })
      .catch((failure) => {
        if (!abort.signal.aborted)
          setError(failure instanceof Error ? failure.message : t("Theme file could not be opened."))
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [documents, path, themeId])

  async function saveFile() {
    if (!document || !path || document.draft === document.baseline || saving) return
    setSaving(true)
    try {
      const token = await getCsrfToken()
      const response = await fetch("/api/admin/themes/source", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": token },
        body: JSON.stringify({ theme: themeId, path, content: document.draft }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error?.message ?? t("Theme file could not be saved."))
      setDocuments((current) => ({
        ...current,
        [path]: { baseline: document.draft, draft: document.draft },
      }))
      toast.success(t("Changes saved."))
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : t("Theme file could not be saved."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="plugin-source-viewer theme-source-editor">
      <div className="plugin-source-layout">
        {(files.length > 0 || directories.length > 0) && (
          <nav className="plugin-source-files" aria-label={t("Theme files")}>
            <h3>{t("Files")}</h3>
            <ThemeTree node={tree} themeId={themeId} selected={path} onSelect={openFile} />
          </nav>
        )}
        <div className="plugin-source-content" aria-busy={loading}>
          {path && (
            <p className="plugin-source-path">
              {path}
              {document && document.draft !== document.baseline && <span>{t("Unsaved changes")}</span>}
            </p>
          )}
          {loading && <p role="status">{t("Loading code…")}</p>}
          {error && <p className="react-form-error" role="alert">{error}</p>}
          {!loading && !error && !path && <p>{t("No source files to preview.")}</p>}
          {path && isImageFile(path) && !imageError && (
            <div className="theme-image-preview">
              <img
                src={imagePreviewUrl(themeId, path)}
                alt={path.split("/").pop() ?? t("Theme image preview")}
                onError={() => setImageError(true)}
              />
            </div>
          )}
          {path && isImageFile(path) && imageError && (
            <p className="react-form-error" role="alert">{t("Image preview could not be loaded.")}</p>
          )}
          {document && !error && (
            <CodeEditor
              value={document.draft}
              onChange={(draft) => setDocuments((current) => ({
                ...current,
                [path]: { ...current[path], draft },
              }))}
              readOnly={false}
              language={languages[path.split(".").pop()?.toLowerCase() ?? ""] ?? "plaintext"}
              height="560px"
              copyLabel={t("Copy code")}
              enableFormat={false}
              toolbarContent={
                <>
                  <DropdownMenu
                    ariaLabel={t("Choose a theme file")}
                    triggerVariant="secondary"
                    triggerClassName="plugin-source-file-select"
                    trigger={<>{path}<DropdownChevron /></>}
                  >
                    {files.map((file) => (
                      <DropdownOption key={file} selected={file === path} onClick={() => openFile(file)}>
                        {file}
                      </DropdownOption>
                    ))}
                  </DropdownMenu>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={saving || document.draft === document.baseline}
                    loading={saving}
                    onClick={() => void saveFile()}
                  >
                    <Save size={16} aria-hidden="true" />{t("Save changes")}
                  </Button>
                </>
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
