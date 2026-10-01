import { CodeEditor } from "./code-editor"

export function ManifestEditor({ value }: { value: Record<string, unknown> }) {
  return <CodeEditor value={JSON.stringify(value, null, 2)} language="json" copyLabel="Копирай manifest" />
}
