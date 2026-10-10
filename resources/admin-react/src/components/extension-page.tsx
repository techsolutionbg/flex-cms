import * as React from "react"
import { createPortal } from "react-dom"
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  GripVertical,
  Image,
  Images,
  Palette,
  Puzzle,
  Save,
  Settings,
  ShoppingBag,
  Users,
  X,
  type LucideIcon,
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
import {
  AdminWorkspaceContext,
  useWorkspaceChanged,
  useWorkspaceSaved,
} from "./admin-workspace-context"
import type { DataTableColumn } from "./data-table"
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
  navigation?: { group: string; icon: string; section?: string; order?: number }
  embeddable: boolean
}

export type ExtensionPanelDescriptor = {
  id: string
  plugin: string
  location: string
  label: string
  module: string
  export: string
  icon: string
  default_open: boolean
  order: number
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
  // Lets a plugin screen (for example the Flex Commerce product editor) host panels of other plugins.
  usePanelSaves,
  // Opens a settings tab registered with the settings.tab panel location.
  openSettingsTab,
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
    ExtensionPanels,
  },
}
type Module = Record<string, unknown> & {
  createPage?: (hostApi: typeof host) => React.ComponentType<Record<string, unknown>>
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

export function panelIcon(name: string): LucideIcon {
  return panelIcons[name] ?? Puzzle
}

const panelIcons: Record<string, LucideIcon> = {
  "file-text": FileText,
  images: Images,
  palette: Palette,
  puzzle: Puzzle,
  settings: Settings,
  "shopping-bag": ShoppingBag,
  users: Users,
}

export type PanelSaveContext = { id: number | string | null }
type PanelSaveHandler = (context: PanelSaveContext) => unknown

/**
 * Collects the save handlers of the panels on one screen. The screen saves its own record first and then
 * calls run({id}) so that panels on a new record receive its ID.
 */
export function usePanelSaves() {
  const handlers = React.useRef(new Map<string, PanelSaveHandler>())
  return React.useMemo(
    () => ({
      register(key: string, handler: PanelSaveHandler) {
        handlers.current.set(key, handler)
        return () => {
          if (handlers.current.get(key) === handler) handlers.current.delete(key)
        }
      },
      async run(context: PanelSaveContext) {
        const failures: string[] = []
        for (const handler of handlers.current.values()) {
          try {
            await handler(context)
          } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error))
          }
        }
        if (failures.length > 0) throw new Error(failures.join(" "))
      },
    }),
    [],
  )
}
export type PanelSaves = ReturnType<typeof usePanelSaves>

export function useExtensionPanels(location: string): ExtensionPanelDescriptor[] {
  const panels = React.useContext(AdminWorkspaceContext)?.extensionPanels
  return React.useMemo(
    () => (panels ?? []).filter((panel) => panel.location === location),
    [panels, location],
  )
}

const panelFactories = new Map<string, Promise<unknown>>()

/** Loads a panel module export once per module version, so its component identity stays stable. */
function loadPanelExport(descriptor: ExtensionPanelDescriptor): Promise<unknown> {
  const key = descriptor.module + "#" + descriptor.export + "@" + descriptor.location
  if (!panelFactories.has(key))
    panelFactories.set(
      key,
      loadModule(descriptor.module)
        .then((module) => {
          const factory = module[descriptor.export]
          if (typeof factory !== "function")
            throw new Error("Разширението няма съвместим интерфейс.")
          return factory(host, { location: descriptor.location, id: descriptor.id })
        })
        .catch((error) => {
          panelFactories.delete(key)
          throw error
        }),
    )
  return panelFactories.get(key)!
}

/** Renders one extension panel component with the screen context and save coordination. */
export function ExtensionPanel({
  descriptor,
  context,
  saves,
}: {
  descriptor: ExtensionPanelDescriptor
  context?: unknown
  saves?: PanelSaves
}) {
  const workspace = React.useContext(AdminWorkspaceContext)
  const changed = useWorkspaceChanged()
  const [Component, setComponent] = React.useState<React.ComponentType<
    Record<string, unknown>
  > | null>(null)
  const [failure, setFailure] = React.useState("")
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => {
    let alive = true
    setFailure("")
    loadPanelExport(descriptor)
      .then((component) => {
        if (!alive) return
        if (typeof component !== "function")
          throw new Error("Разширението няма съвместим интерфейс.")
        setComponent(() => component as React.ComponentType<Record<string, unknown>>)
      })
      .catch((error) => {
        if (alive) setFailure(error instanceof Error ? error.message : String(error))
      })
    return () => {
      alive = false
    }
  }, [descriptor, attempt])
  const registerSave = React.useCallback(
    (handler: PanelSaveHandler) => saves?.register(descriptor.id, handler) ?? (() => {}),
    [saves, descriptor.id],
  )
  if (failure)
    return (
      <div role="alert">
        <p>{failure}</p>
        <Button variant="secondary" type="button" onClick={() => setAttempt(attempt + 1)}>
          Опитай отново
        </Button>
      </div>
    )
  return Component ? (
    <ExtensionBoundary key={descriptor.module}>
      <Component
        context={context}
        location={descriptor.location}
        registerSave={registerSave}
        changed={changed}
        navigate={workspace?.open}
      />
    </ExtensionBoundary>
  ) : (
    <p role="status">Зареждане…</p>
  )
}

/** All panels of active plugins for a location, each in its own collapsible section. */
export function ExtensionPanels({
  location,
  context,
  saves,
}: {
  location: string
  context?: unknown
  saves?: PanelSaves
}) {
  const panels = useExtensionPanels(location)
  return (
    <>
      {panels.map((panel) => (
        <CollapsibleSection
          key={panel.id}
          title={panel.label}
          icon={panelIcons[panel.icon] ?? Puzzle}
          defaultOpen={panel.default_open}
          storageKey={`panel:${panel.location}:${panel.id}`}
          className={`extension-panel extension-panel-${panel.id}`}
        >
          <div id={`panel-${panel.id}`}>
            <ExtensionPanel descriptor={panel} context={context} saves={saves} />
          </div>
        </CollapsibleSection>
      ))}
    </>
  )
}

/** A column contributed by a plugin: data is loaded once per row set, rendering is synchronous. */
export type ExtensionColumn<T> = {
  label?: string
  load?: (rows: T[]) => Promise<unknown>
  render: (row: T, data: unknown) => React.ReactNode
  sortValue?: (row: T, data: unknown) => string | number
}

/** DataTable columns contributed by active plugins for a list location. */
export function useExtensionColumns<T>(location: string, rows: T[]): DataTableColumn<T>[] {
  const descriptors = useExtensionPanels(location)
  const [columns, setColumns] = React.useState<
    { descriptor: ExtensionPanelDescriptor; column: ExtensionColumn<T> }[]
  >([])
  const [data, setData] = React.useState<Record<string, unknown>>({})
  React.useEffect(() => {
    let alive = true
    Promise.all(
      descriptors.map((descriptor) =>
        loadPanelExport(descriptor)
          .then((column) => ({ descriptor, column: column as ExtensionColumn<T> }))
          .catch(() => null),
      ),
    ).then((loaded) => {
      if (alive)
        setColumns(
          loaded.filter((item): item is NonNullable<typeof item> =>
            Boolean(item && typeof item.column?.render === "function"),
          ),
        )
    })
    return () => {
      alive = false
    }
  }, [descriptors])
  React.useEffect(() => {
    let alive = true
    columns.forEach(({ descriptor, column }) => {
      column
        .load?.(rows)
        .then((value) => {
          if (alive) setData((current) => ({ ...current, [descriptor.id]: value }))
        })
        .catch(() => {})
    })
    return () => {
      alive = false
    }
  }, [columns, rows])
  return columns.map(({ descriptor, column }) => ({
    key: "extension:" + descriptor.id,
    label: column.label ?? descriptor.label,
    render: (row: T) => column.render(row, data[descriptor.id]),
    sortable: Boolean(column.sortValue),
    sortValue: column.sortValue
      ? (row: T) => column.sortValue!(row, data[descriptor.id])
      : undefined,
  }))
}
