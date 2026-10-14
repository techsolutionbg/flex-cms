// Runtime of admin extension points: named collapsible sections, tables and screens accept content from plugins.
// It does not import the components it extends, so CollapsibleSection and DataTable can use it without cycles.
import { t } from "@/lib/admin-i18n"
import * as React from "react"
import {
  FileText,
  Images,
  KeyRound,
  ListChecks,
  Palette,
  Puzzle,
  Search,
  Settings,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react"
import { AdminWorkspaceContext, useWorkspaceChanged } from "./admin-workspace-context"
import type { DataTableColumn } from "./data-table"
import { Button } from "./ui/button"

/** One registration of $context->admin->extend() (or panel()), as served by /api/admin/extensions. */
export type ExtensionDescriptor = {
  id: string
  plugin: string
  point: string
  slot: string
  label: string
  module: string
  export: string
  icon: string
  default_open: boolean
  order: number
}

let extensionHost: unknown = null

/** The host object (React, UI components, helpers) every extension factory receives. */
export function setExtensionHost(host: unknown): void {
  extensionHost = host
}

const modules = new Map<string, Promise<Record<string, unknown>>>()

export function loadModule(url: string): Promise<Record<string, unknown>> {
  if (
    !url.startsWith("/extensions/") ||
    !/^\/extensions\/[a-zA-Z0-9_/.\-]+\.js(?:\?v=[a-f0-9]{16}(?:&retry=\d+)?|\?retry=\d+)?$/.test(url) ||
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

export class ExtensionBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <p role="alert">{t("An extension interface error occurred. Reload the page.")}</p>
    ) : (
      this.props.children
    )
  }
}

const icons: Record<string, LucideIcon> = {
  "file-text": FileText,
  images: Images,
  key: KeyRound,
  "list-checks": ListChecks,
  palette: Palette,
  puzzle: Puzzle,
  search: Search,
  settings: Settings,
  share: Share2,
  "shopping-bag": ShoppingBag,
  sliders: SlidersHorizontal,
  users: Users,
}

export function panelIcon(name: string): LucideIcon {
  return icons[name] ?? Puzzle
}

export type PanelSaveContext = { id: number | string | null }
type PanelSaveHandler = (context: PanelSaveContext) => unknown

/**
 * Collects the save handlers of the extensions on one screen. The screen saves its own record first and then
 * calls run({id}) so that extensions on a new record receive its ID.
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

/** What a screen shares with every extension inside it: the record being edited and its save coordination. */
export type ExtensionScopeValue = { context?: unknown; saves?: PanelSaves }
const ExtensionScopeContext = React.createContext<ExtensionScopeValue>({})

export function ExtensionScope({
  value,
  children,
}: {
  value: ExtensionScopeValue
  children: React.ReactNode
}) {
  return <ExtensionScopeContext.Provider value={value}>{children}</ExtensionScopeContext.Provider>
}

export function useExtensionScope(): ExtensionScopeValue {
  return React.useContext(ExtensionScopeContext)
}

/** Extensions of active plugins registered for a point and slot, in their order. */
export function useExtensions(point: string | undefined, slot: string): ExtensionDescriptor[] {
  const extensions = React.useContext(AdminWorkspaceContext)?.extensions
  return React.useMemo(
    () =>
      point
        ? (extensions ?? []).filter(
            (extension) => extension.point === point && extension.slot === slot,
          )
        : [],
    [extensions, point, slot],
  )
}

const factories = new Map<string, Promise<unknown>>()

/** Calls a module export once per module version, point and slot, so component identity stays stable. */
export function loadExtensionExport(descriptor: ExtensionDescriptor): Promise<unknown> {
  const key = `${descriptor.module}#${descriptor.export}@${descriptor.point}/${descriptor.slot}`
  if (!factories.has(key))
    factories.set(
      key,
      loadModule(descriptor.module)
        .then((module) => {
          const factory = module[descriptor.export]
          if (typeof factory !== "function")
            throw new Error("Разширението няма съвместим интерфейс.")
          return factory(extensionHost, {
            point: descriptor.point,
            slot: descriptor.slot,
            id: descriptor.id,
            // Panels written for panel() read "location".
            location: legacyLocation(descriptor),
          })
        })
        .catch((error) => {
          factories.delete(key)
          throw error
        }),
    )
  return factories.get(key)!
}

function legacyLocation(descriptor: ExtensionDescriptor): string {
  if (descriptor.slot === "table.column" && descriptor.point === "pages.list")
    return "pages.list.column"
  if (descriptor.slot === "screen.tab" && descriptor.point === "settings") return "settings.tab"
  return descriptor.point
}

/** Renders one extension component with the screen context and save coordination. */
export function ExtensionComponent({
  descriptor,
  context,
  saves,
  props,
}: {
  descriptor: ExtensionDescriptor
  context?: unknown
  saves?: PanelSaves
  props?: Record<string, unknown>
}) {
  const scope = useExtensionScope()
  const workspace = React.useContext(AdminWorkspaceContext)
  const changed = useWorkspaceChanged()
  const activeSaves = saves ?? scope.saves
  const [Component, setComponent] = React.useState<React.ComponentType<
    Record<string, unknown>
  > | null>(null)
  const [failure, setFailure] = React.useState("")
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => {
    let alive = true
    setFailure("")
    loadExtensionExport(descriptor)
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
    (handler: PanelSaveHandler) =>
      activeSaves?.register(`${descriptor.point}/${descriptor.slot}/${descriptor.id}`, handler) ??
      (() => {}),
    [activeSaves, descriptor.point, descriptor.slot, descriptor.id],
  )
  if (failure)
    return (
      <div role="alert">
        <p>{failure}</p>
        <Button variant="secondary" type="button" onClick={() => setAttempt(attempt + 1)}>

          {t("Try again")}
        </Button>
      </div>
    )
  return Component ? (
    <ExtensionBoundary key={descriptor.module}>
      <Component
        context={context ?? scope.context}
        point={descriptor.point}
        slot={descriptor.slot}
        location={legacyLocation(descriptor)}
        registerSave={registerSave}
        changed={changed}
        navigate={workspace?.open}
        {...props}
      />
    </ExtensionBoundary>
  ) : (
    <p role="status">{t("Loading…")}</p>
  )
}

/** Every extension component of a slot, one after another (section.start, section.end, screen content). */
export function ExtensionSlot({ point, slot }: { point?: string; slot: string }) {
  const extensions = useExtensions(point, slot)
  if (extensions.length === 0) return null
  return (
    <>
      {extensions.map((extension) => (
        <div
          key={extension.id}
          className={`extension-slot extension-slot-${slot.replace(".", "-")}`}
          data-extension={extension.id}
        >
          <ExtensionComponent descriptor={extension} />
        </div>
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
export type ExtensionActionHelpers = {
  navigate?: (path: string) => void
  refresh?: () => void
}
export type ExtensionRowAction<T> = {
  label: string
  onSelect: (row: T, helpers: ExtensionActionHelpers) => unknown
  visible?: (row: T) => boolean
  danger?: boolean
  /** Show this editor action only when the page declares this plugin as its content editor. */
  contentBuilder?: string
}
export type ExtensionBulkAction<T> = {
  label: string
  run: (rows: T[], helpers: ExtensionActionHelpers) => unknown
  danger?: boolean
}

type Loaded<V> = { descriptor: ExtensionDescriptor; value: V }

function useLoadedExports<V>(
  descriptors: ExtensionDescriptor[],
  accept: (value: unknown) => boolean,
): Loaded<V>[] {
  const [loaded, setLoaded] = React.useState<Loaded<V>[]>([])
  React.useEffect(() => {
    let alive = true
    Promise.all(
      descriptors.map((descriptor) =>
        loadExtensionExport(descriptor)
          .then((value) => (accept(value) ? { descriptor, value: value as V } : null))
          .catch(() => null),
      ),
    ).then((items) => {
      if (alive) setLoaded(items.filter((item): item is Loaded<V> => item !== null))
    })
    return () => {
      alive = false
    }
    // accept is a pure type check per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptors])
  return loaded
}

const isObjectWith = (key: string) => (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>)[key] === "function"

/**
 * Columns, row actions, bulk actions and toolbar filters that plugins add to a table.
 * rowsKey identifies the row set, so column data is loaded again only when the rows really change.
 */
export function useTableExtensions<T>(point: string | undefined, rows: T[], rowsKey: string) {
  const workspace = React.useContext(AdminWorkspaceContext)
  const columnDescriptors = useExtensions(point, "table.column")
  const actionDescriptors = useExtensions(point, "table.row-action")
  const bulkDescriptors = useExtensions(point, "table.bulk-action")
  const toolbars = useExtensions(point, "table.toolbar")
  const columns = useLoadedExports<ExtensionColumn<T>>(columnDescriptors, isObjectWith("render"))
  const actions = useLoadedExports<ExtensionRowAction<T>>(
    actionDescriptors,
    isObjectWith("onSelect"),
  )
  const bulk = useLoadedExports<ExtensionBulkAction<T>>(bulkDescriptors, isObjectWith("run"))
  const [data, setData] = React.useState<Record<string, unknown>>({})
  const [filters, setFilters] = React.useState<Record<string, (row: T) => boolean>>({})
  const rowsRef = React.useRef(rows)
  rowsRef.current = rows
  React.useEffect(() => {
    let alive = true
    columns.forEach(({ descriptor, value }) => {
      value
        .load?.(rowsRef.current)
        .then((result) => {
          if (alive) setData((current) => ({ ...current, [descriptor.id]: result }))
        })
        .catch(() => {})
    })
    return () => {
      alive = false
    }
  }, [columns, rowsKey])
  const helpers: ExtensionActionHelpers = React.useMemo(
    () => ({ navigate: workspace?.open, refresh: workspace?.refresh }),
    [workspace?.open, workspace?.refresh],
  )
  const setFilter = React.useCallback(
    (id: string, filter: ((row: T) => boolean) | null) =>
      setFilters((current) => {
        const next = { ...current }
        if (filter) next[id] = filter
        else delete next[id]
        return next
      }),
    [],
  )
  const activeFilters = Object.values(filters)
  return {
    columns: columns.map(
      ({ descriptor, value }): DataTableColumn<T> => ({
        key: "extension:" + descriptor.id,
        label: value.label ?? descriptor.label,
        render: (row: T) => value.render(row, data[descriptor.id]),
        sortable: Boolean(value.sortValue),
        sortValue: value.sortValue
          ? (row: T) => value.sortValue!(row, data[descriptor.id])
          : undefined,
      }),
    ),
    rowActions: actions.map(({ value }) => value),
    bulkActions: bulk.map(({ value }) => value),
    toolbars,
    helpers,
    setFilter,
    filter: activeFilters.length ? (row: T) => activeFilters.every((filter) => filter(row)) : null,
  }
}

/** The plugin row actions of the table row being rendered, read by TableActionsMenu. */
export type RowExtensionActions = {
  row: unknown
  actions: ExtensionRowAction<unknown>[]
  helpers: ExtensionActionHelpers
}
export const RowExtensionActionsContext = React.createContext<RowExtensionActions | null>(null)
