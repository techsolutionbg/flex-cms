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
  KeyRound,
  ListChecks,
  Save,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { AdminShell } from "./admin-shell"
import { Breadcrumbs } from "./breadcrumbs"
import { CheckboxField } from "./checkbox-field"
import { CollapsibleSection } from "./collapsible-section"
import { ConfirmDialog } from "./confirm-dialog"
import { DataTable } from "./data-table"
import { TableSkeleton } from "./table-skeleton"
import { DropdownMenu, DropdownOption, DropdownChevron } from "./dropdown-menu"
import { TableActionsMenu } from "./table-actions-menu"
import { LoadingButton } from "./loading-button"
import { MediaPicker } from "./media-picker"
import { Hint, useHintsVisible, usePageHelp } from "./page-help"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { RichTextEditor } from "./rich-text-editor"
import { Button } from "./ui/button"
import {
  useWorkspaceChanged,
  useWorkspacePanelActive,
  useWorkspaceSaved,
} from "./admin-workspace-context"
import {
  ExtensionBoundary,
  ExtensionComponent,
  ExtensionScope,
  ExtensionSlot,
  loadModule,
  panelIcon,
  setExtensionHost,
  useExtensions,
  useExtensionScope,
  usePanelSaves,
  type ExtensionDescriptor,
  type PanelSaves,
} from "./extension-runtime"
import { mediaRequest } from "@/lib/media-api"
import { openSettingsTab } from "@/lib/settings-tabs"
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
  navigation?: { group: string; icon: string; section?: string; order?: number; hidden?: boolean }
  embeddable: boolean
}

// The runtime of extension points lives in extension-runtime.tsx; these exports keep existing imports working.
export {
  ExtensionScope,
  ExtensionSlot,
  panelIcon,
  useExtensions,
  useExtensionScope,
  usePanelSaves,
  type ExtensionDescriptor,
  type PanelSaves,
}
export type { PanelSaveContext } from "./extension-runtime"
/** @deprecated Use ExtensionDescriptor. */
export type ExtensionPanelDescriptor = ExtensionDescriptor

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
    KeyRound,
    ListChecks,
    Save,
    Search,
    Settings,
    Share2,
    SlidersHorizontal,
    X,
  },
  toast,
  request: mediaRequest,
  // The platform time standard; plugins show times with components.DateTime or these helpers.
  time: { dayjs, formatExact, formatFull, formatRelative, isoUtc, parse, subscribe, zoneName },
  useWorkspaceChanged,
  useWorkspacePanelActive,
  useWorkspaceSaved,
  // Lets a plugin screen (for example the Flex Commerce product editor) host panels of other plugins.
  usePanelSaves,
  // Plugin screens share their record with extensions inside them, like the platform screens.
  useExtensionScope,
  // Adds guidance for the current screen to the header's help dialog; components.Hint shows inline guidance.
  usePageHelp,
  useHintsVisible,
  // Opens a settings tab registered with the settings.tab panel location.
  openSettingsTab,
  components: {
    Breadcrumbs,
    CheckboxField,
    CollapsibleSection,
    ConfirmDialog,
    DataTable,
    TableSkeleton,
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
    ExtensionPanels,
    ExtensionScope,
    ExtensionSlot,
    Hint,
  },
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
        const factory = (embed ? module.createEmbedPicker : module.createPage) as
          | ((hostApi: typeof host) => React.ComponentType<Record<string, unknown>>)
          | undefined
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

setExtensionHost(host)

/** Panels of active plugins for a screen (slot screen.section), each in its own collapsible section. */
export function ExtensionPanels({
  location,
  context,
  saves,
}: {
  location: string
  context?: unknown
  saves?: PanelSaves
}) {
  const panels = useExtensions(location, "screen.section")
  return (
    <>
      {panels.map((panel) => (
        <CollapsibleSection
          key={panel.id}
          title={panel.label}
          icon={panelIcon(panel.icon)}
          defaultOpen={panel.default_open}
          storageKey={`panel:${panel.point}:${panel.id}`}
          className={`extension-panel extension-panel-${panel.id}`}
        >
          <div id={`panel-${panel.id}`}>
            <ExtensionComponent descriptor={panel} context={context} saves={saves} />
          </div>
        </CollapsibleSection>
      ))}
    </>
  )
}

/** One extension rendered on its own, for example a settings tab. */
export function ExtensionPanel({
  descriptor,
  context,
  saves,
}: {
  descriptor: ExtensionDescriptor
  context?: unknown
  saves?: PanelSaves
}) {
  return <ExtensionComponent descriptor={descriptor} context={context} saves={saves} />
}
