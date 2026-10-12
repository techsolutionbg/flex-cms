import { CircleHelp, Info, X } from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { CheckboxField } from "./checkbox-field"
import { LoadingButton } from "./loading-button"
import { Button } from "./ui/button"

/** Guidance for the current screen, shown in the header's help dialog. Screens and plugins add their own. */
export type PageHelpEntry = { title: string; content: ReactNode }

type Registry = { register: (id: string, entry: () => PageHelpEntry) => () => void }

const PageHelpContext = createContext<Registry | null>(null)
const storageKey = "flex-admin-hints"
const changeEvent = "flex-admin-hints-changed"

/** Whether inline guidance (Hint) is shown; the user switches it in the help dialog. */
export function hintsVisible(): boolean {
  try {
    return window.localStorage.getItem(storageKey) !== "0"
  } catch {
    return true
  }
}

export function setHintsVisible(visible: boolean): void {
  try {
    window.localStorage.setItem(storageKey, visible ? "1" : "0")
  } catch {
    // The choice still applies until the page is reloaded.
  }
  memory = visible
  window.dispatchEvent(new Event(changeEvent))
}

let memory: boolean | null = null

function subscribe(callback: () => void) {
  window.addEventListener(changeEvent, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(changeEvent, callback)
    window.removeEventListener("storage", callback)
  }
}

export function useHintsVisible(): boolean {
  const snapshot = () => memory ?? hintsVisible()
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/**
 * Adds guidance for the screen that renders it to the help dialog in the header, for as long as it is shown.
 * The entry is read when the dialog opens, so it may change freely between renders.
 */
export function usePageHelp(entry: PageHelpEntry | null): void {
  const registry = useContext(PageHelpContext)
  const id = useId()
  const latest = useRef(entry)
  latest.current = entry
  const present = entry !== null
  useEffect(() => {
    if (!registry || !present) return
    return registry.register(id, () => latest.current!)
  }, [registry, id, present])
}

/** Inline guidance, hidden for everyone who turned guidance off. */
export function Hint({ children }: { children: ReactNode }) {
  const visible = useHintsVisible()
  if (!visible) return null
  return (
    <div className="admin-hint" role="note">
      <Info size={18} aria-hidden="true" />
      <div className="admin-hint-text">{children}</div>
      <button
        type="button"
        className="admin-hint-close"
        aria-label="Скрий насоките"
        title="Скрий насоките (можете да ги включите отново от „Помощ“)"
        onClick={() => setHintsVisible(false)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

/** Holds the guidance of the screen inside it and renders the help button for the header. */
export function usePageHelpRegistry() {
  const entries = useRef(new Map<string, () => PageHelpEntry>())
  const [, setVersion] = useState(0)
  const register = useCallback((id: string, entry: () => PageHelpEntry) => {
    entries.current.set(id, entry)
    setVersion((value) => value + 1)
    return () => {
      entries.current.delete(id)
      setVersion((value) => value + 1)
    }
  }, [])
  const registry = useMemo<Registry>(() => ({ register }), [register])
  return { registry, entries: () => Array.from(entries.current.values(), (entry) => entry()) }
}

export function PageHelpProvider({ registry, children }: { registry: Registry; children: ReactNode }) {
  return <PageHelpContext.Provider value={registry}>{children}</PageHelpContext.Provider>
}

export function PageHelpButton({ entries }: { entries: () => PageHelpEntry[] }) {
  const [open, setOpen] = useState(false)
  const visible = useHintsVisible()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (open) ref.current?.showModal()
    else ref.current?.close()
  }, [open])
  const list = open ? entries() : []
  return (
    <>
      <LoadingButton
        className="admin-page-refresh"
        type="button"
        title="Насоки за работа с тази страница"
        aria-haspopup="dialog"
        icon={<CircleHelp size={18} aria-hidden="true" />}
        onClick={() => setOpen(true)}
      >
        <span>Помощ</span>
      </LoadingButton>
      {createPortal(
        <dialog
          ref={ref}
          className="media-picker-dialog page-help-dialog"
          aria-labelledby={titleId}
          data-workspace-transient="true"
          onCancel={(event) => {
            event.preventDefault()
            setOpen(false)
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div className="media-picker-heading">
            <h2 id={titleId}>Помощ</h2>
            <Button type="button" variant="secondary" aria-label="Затвори" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>
          {open && (
            <div className="page-help-body">
              {list.length === 0 ? (
                <p className="page-help-empty">Няма специални насоки за тази страница.</p>
              ) : (
                list.map((entry, index) => (
                  <section key={index} className="page-help-entry">
                    <h3>{entry.title}</h3>
                    <div className="page-help-content">{entry.content}</div>
                  </section>
                ))
              )}
              <div className="page-help-settings">
                <CheckboxField
                  checked={visible}
                  label="Показвай насоките в страниците"
                  description="Кратките обяснения в самите страници. Тази помощ остава достъпна винаги."
                  onChange={(event) => setHintsVisible(event.target.checked)}
                />
              </div>
            </div>
          )}
        </dialog>,
        document.body,
      )}
    </>
  )
}
