import * as React from "react"
import { createPortal } from "react-dom"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  GripVertical,
  Image,
  Images,
  Save,
  Settings,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "./admin-shell"
import { Breadcrumbs } from "./breadcrumbs"
import { CheckboxField } from "./checkbox-field"
import { CollapsibleSection } from "./collapsible-section"
import { ConfirmDialog } from "./confirm-dialog"
import { DataTable } from "./data-table"
import { DropdownMenu, DropdownOption, DropdownChevron } from "./dropdown-menu"
import { TableActionsMenu } from "./table-actions-menu"
import { LoadingButton } from "./loading-button"
import { MediaPicker } from "./media-picker"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { RichTextEditor } from "./rich-text-editor"
import { Button } from "./ui/button"
import { useWorkspaceChanged, useWorkspaceSaved } from "./admin-workspace-context"
import { mediaRequest } from "@/lib/media-api"
import { DateTime } from "./date-time"
import {
  dayjs,
  formatExact,
  formatFull,
  formatRelative,
  isoUtc,
  parse,
  subscribe,
  zoneName,
} from "@/lib/flex-time"

export type ExtensionPageDescriptor = {
  id: string
  label: string
  href: string
  module: string
  navigation?: { group: string; icon: string; section?: string; order?: number }
  embeddable: boolean
}

function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDialogElement>(null)
  const id = React.useId()
  React.useEffect(() => {
    if (open) ref.current?.showModal()
    else ref.current?.close()
  }, [open])
  return createPortal(
    <dialog
      ref={ref}
      className="media-picker-dialog"
      aria-labelledby={id}
      data-workspace-transient="true"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="media-picker-heading">
        <h2 id={id}>{title}</h2>
        <Button type="button" variant="secondary" aria-label="Затвори" onClick={onClose}>
          <X />
        </Button>
      </div>
      {open && children}
    </dialog>,
    document.body,
  )
}

// Plugins share this React instance and the platform's UI instead of bundling their own.
const host = {
  React,
  icons: {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    Eye,
    GripVertical,
    Image,
    Images,
    Save,
    Settings,
    X,
  },
  toast,
  request: mediaRequest,
  // The platform time standard; plugins show times with components.DateTime or these helpers.
  time: { dayjs, formatExact, formatFull, formatRelative, isoUtc, parse, subscribe, zoneName },
  useWorkspaceChanged,
  useWorkspaceSaved,
  components: {
    Breadcrumbs,
    CheckboxField,
    CollapsibleSection,
    ConfirmDialog,
    DataTable,
    DropdownMenu,
    DropdownOption,
    DropdownChevron,
    TableActionsMenu,
    LoadingButton,
    MediaPicker,
    Input,
    Textarea,
    RichTextEditor,
    Button,
    Dialog,
    DateTime,
  },
}
type Module = {
  createPage: (hostApi: typeof host) => React.ComponentType<Record<string, unknown>>
  createEmbedPicker?: (hostApi: typeof host) => React.ComponentType<Record<string, unknown>>
}
const modules = new Map<string, Promise<Module>>()
class ExtensionBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <p role="alert">Възникна грешка в интерфейса на разширението. Презаредете страницата.</p>
    ) : (
      this.props.children
    )
  }
}
function loadModule(url: string) {
  if (
    !url.startsWith("/extensions/") ||
    !/^\/extensions\/[a-zA-Z0-9_/.\-]+\.js(?:\?v=[a-f0-9]{16})?$/.test(url) ||
    url.includes("..")
  )
    return Promise.reject(new Error("Невалиден модул на разширение."))
  if (!modules.has(url))
    modules.set(
      url,
      import(/* @vite-ignore */ url).catch((error) => {
        modules.delete(url)
        throw error
      }),
    )
  return modules.get(url)!
}

export function ExtensionModule({
  descriptor,
  embed = false,
  ...props
}: {
  descriptor: ExtensionPageDescriptor
  embed?: boolean
  [key: string]: unknown
}) {
  const [Component, setComponent] = React.useState<React.ComponentType<
    Record<string, unknown>
  > | null>(null)
  const [failure, setFailure] = React.useState("")
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => {
    let alive = true
    setFailure("")
    setComponent(null)
    loadModule(descriptor.module)
      .then((module) => {
        const factory = embed ? module.createEmbedPicker : module.createPage
        if (typeof factory !== "function") throw new Error("Разширението няма съвместим интерфейс.")
        const component = factory(host)
        if (alive) setComponent(() => component)
      })
      .catch((error) => {
        if (alive) setFailure(error.message)
      })
    return () => {
      alive = false
    }
  }, [descriptor.module, embed, attempt])
  if (failure)
    return (
      <div role="alert">
        <p>{failure}</p>
        <Button variant="secondary" onClick={() => setAttempt(attempt + 1)}>
          Опитай отново
        </Button>
      </div>
    )
  return Component ? (
    <ExtensionBoundary key={descriptor.module}>
      <Component {...props} />
    </ExtensionBoundary>
  ) : (
    <p role="status">Зареждане…</p>
  )
}

export function ExtensionPage({
  descriptor,
  path,
  navigate,
  ...shell
}: {
  descriptor: ExtensionPageDescriptor
  path: string
  navigate: (path: string) => void
  onLogout: () => void
  loggingOut: boolean
  onNavigate: (label: string) => void
}) {
  return (
    <AdminShell {...shell} title={descriptor.label} activeItem={descriptor.href}>
      <ExtensionModule descriptor={descriptor} path={path} navigate={navigate} />
    </AdminShell>
  )
}
