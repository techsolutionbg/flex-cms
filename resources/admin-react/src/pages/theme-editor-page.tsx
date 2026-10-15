import { t } from "@/lib/admin-i18n"
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { AdminShell } from "@/components/admin-shell"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { DropdownChevron, DropdownMenu, DropdownOption } from "@/components/dropdown-menu"
import { ThemeSourceEditor } from "@/components/theme-source-editor"
import { Button } from "@/components/ui/button"
import { ExtensionComponent, ExtensionScope, useExtensions, usePanelSaves } from "@/components/extension-runtime"
import { getCsrfToken } from "@/lib/admin-api"
import type { ThemeRecord } from "@/lib/admin-types"
import { Code2, Eye, GripVertical, Maximize2, Minimize2, Monitor, Save, Smartphone, Tablet } from "lucide-react"
import { toast } from "sonner"

type PreviewWidth = "desktop" | "tablet" | "mobile"

const PREVIEW_BRIDGE = `<script data-flex-preview-bridge>
(() => {
  const boundTopButtons = new WeakSet();
  const refreshQuickActions = () => {
    const actions = document.querySelector('.quick-actions');
    if (!actions) return;
    actions.classList.toggle('is-visible', window.scrollY > 480);
    const topButton = actions.querySelector('.quick-action-top');
    if (topButton && !boundTopButtons.has(topButton)) {
      boundTopButtons.add(topButton);
      topButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
    }
  };
  window.addEventListener('scroll', refreshQuickActions, { passive: true });
  const keyOf = (node) => node.nodeType === 1 ? (node.id || node.getAttribute('data-preview-key')) : null;
  const compatible = (a, b) => a && b && a.nodeType === b.nodeType && (a.nodeType !== 1 || a.localName === b.localName);
  const copyAttributes = (current, fresh) => {
    for (const attribute of Array.from(current.attributes)) if (!fresh.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
    for (const attribute of Array.from(fresh.attributes)) if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  };
  const patch = (current, fresh) => {
    if (!compatible(current, fresh)) return current;
    if (current.nodeType === 3 || current.nodeType === 8) {
      if (current.nodeValue !== fresh.nodeValue) current.nodeValue = fresh.nodeValue;
      return current;
    }
    if (current.localName === 'script') return current;
    copyAttributes(current, fresh);
    let cursor = current.firstChild;
    for (const freshChild of Array.from(fresh.childNodes)) {
      if (freshChild.nodeType === 1 && freshChild.localName === 'script') {
        if (cursor && cursor.nodeType === 1 && cursor.localName === 'script') cursor = cursor.nextSibling;
        continue;
      }
      const key = keyOf(freshChild);
      let match = cursor;
      if (key) while (match && (!compatible(match, freshChild) || keyOf(match) !== key)) match = match.nextSibling;
      if (!compatible(match, freshChild)) {
        const inserted = document.importNode(freshChild, true);
        current.insertBefore(inserted, cursor);
        cursor = inserted.nextSibling;
        continue;
      }
      if (match !== cursor) current.insertBefore(match, cursor);
      patch(match, freshChild);
      cursor = match.nextSibling;
    }
    while (cursor) {
      const next = cursor.nextSibling;
      if (!(cursor.nodeType === 1 && cursor.localName === 'script')) current.removeChild(cursor);
      cursor = next;
    }
    return current;
  };
  const syncThemeDesignTokens = (freshDocument) => {
    const freshTokens = freshDocument.head.querySelector('style[data-theme-color-vars]');
    let currentTokens = document.head.querySelector('style[data-theme-color-vars]');
    if (freshTokens) {
      if (!currentTokens) {
        currentTokens = document.createElement('style');
        currentTokens.setAttribute('data-theme-color-vars', '');
        document.head.appendChild(currentTokens);
      }
      if (currentTokens.textContent !== freshTokens.textContent) currentTokens.textContent = freshTokens.textContent;
    }

    for (const attribute of ['data-primary-button-style', 'data-secondary-button-style']) {
      const value = freshDocument.body.getAttribute(attribute);
      if (value === null) document.body.removeAttribute(attribute);
      else if (document.body.getAttribute(attribute) !== value) document.body.setAttribute(attribute, value);
    }
  };
  const resolvePreviewLink = (anchor) => {
    try {
      const url = new URL(anchor.href);
      const previewBase = document.querySelector('base[href]')?.href;
      if (!previewBase) return null;
      const siteOrigin = new URL(previewBase).origin;
      return url.origin === siteOrigin ? url.href : null;
    } catch {
      return null;
    }
  };
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    const href = resolvePreviewLink(anchor);
    if (!href) return;
    event.preventDefault();
    window.parent.postMessage({ type: 'flex-theme-preview-navigate', url: href }, '*');
  }, true);
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !['flex-theme-preview-update', 'flex-theme-preview-navigate-response'].includes(event.data?.type) || typeof event.data.html !== 'string') return;
    const parsed = new DOMParser().parseFromString(event.data.html, 'text/html');
    if (parsed.documentElement.lang) document.documentElement.lang = parsed.documentElement.lang;
    if (event.data.type === 'flex-theme-preview-navigate-response') {
      const currentTokens = document.head.querySelector('style[data-theme-color-vars]');
      const freshTokens = parsed.head.querySelector('style[data-theme-color-vars]');
      if (currentTokens && freshTokens) freshTokens.textContent = currentTokens.textContent;
      for (const attribute of ['data-primary-button-style', 'data-secondary-button-style']) {
        const currentValue = document.body.getAttribute(attribute);
        if (currentValue !== null) parsed.body.setAttribute(attribute, currentValue);
      }
    }
    patch(document.head, parsed.head);
    patch(document.body, parsed.body);
    syncThemeDesignTokens(parsed);
    refreshQuickActions();
    window.flexRoofcraftRefreshParticles?.();
    window.parent.postMessage({type: 'flex-theme-preview-updated'}, '*');
  });
  refreshQuickActions();
  window.parent.postMessage({type: 'flex-theme-preview-ready'}, '*');
})();
</script>`

export function ThemeEditorPage({
  onLogout,
  onNavigate,
  loggingOut,
}: {
  onLogout: () => void
  onNavigate: (label: string) => void
  loggingOut: boolean
}) {
  const [themes, setThemes] = useState<ThemeRecord[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState("")
  const [loadingThemes, setLoadingThemes] = useState(true)
  const [view, setView] = useState<"builder" | "files">("builder")
  const [expanded, setExpanded] = useState(() => new URLSearchParams(window.location.search).get("fullscreen") === "1")
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop")
  const [previewHtml, setPreviewHtml] = useState("")
  const [previewBusy, setPreviewBusy] = useState(false)
  const [panelWidth, setPanelWidth] = useState<number | null>(null)
  const [resizingPanel, setResizingPanel] = useState(false)
  const [panelDirty, setPanelDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fileDirty, setFileDirty] = useState(false)
  const previewTimer = useRef<number | null>(null)
  const previewSequence = useRef(0)
  const previewFrame = useRef<HTMLIFrameElement>(null)
  const previewFrameReady = useRef(false)
  const previewDocumentSet = useRef(false)
  const pendingPreviewHtml = useRef("")
  const saves = usePanelSaves()

  useEffect(() => {
    const syncFullscreenFromUrl = () => setExpanded(new URLSearchParams(window.location.search).get("fullscreen") === "1")
    window.addEventListener("popstate", syncFullscreenFromUrl)
    return () => window.removeEventListener("popstate", syncFullscreenFromUrl)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const nextExpanded = !expanded
    const params = new URLSearchParams(window.location.search)
    if (nextExpanded) params.set("fullscreen", "1")
    else params.delete("fullscreen")
    const query = params.toString()
    window.history.pushState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`)
    setExpanded(nextExpanded)
  }, [expanded])

  useEffect(() => {
    if (!panelDirty && !fileDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeUnload)
    return () => window.removeEventListener("beforeunload", warnBeforeUnload)
  }, [panelDirty, fileDirty])

  function resizePanel(clientX: number) {
    const max = Math.max(320, window.innerWidth - 400)
    setPanelWidth(Math.max(280, Math.min(max, clientX)))
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/admin/themes", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as {
          themes?: ThemeRecord[]
          error?: { message?: string }
        }
        if (!response.ok) throw new Error(body.error?.message ?? "Темите не можаха да бъдат заредени.")
        const installedThemes = body.themes ?? []
        setThemes(installedThemes)
        setSelectedThemeId(installedThemes.find((theme) => theme.active)?.id ?? "")
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          toast.error(reason instanceof Error ? reason.message : "Темите не можаха да бъдат заредени.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingThemes(false)
      })
    return () => controller.abort()
  }, [])

  const selectedTheme = themes.find((theme) => theme.id === selectedThemeId)
  const panels = useExtensions(selectedTheme?.active ? "theme.settings" : undefined, "screen.section")
  const panelContext = useMemo(() => ({ type: "theme", id: selectedThemeId, theme: selectedTheme }), [selectedTheme, selectedThemeId])
  const extensionScope = useMemo(() => ({ context: panelContext, saves }), [panelContext, saves])

  const renderPreview = useCallback(async (sections: Record<string, unknown> | null) => {
    if (!selectedThemeId) return
    const sequence = ++previewSequence.current
    setPreviewBusy(true)
    try {
      const headers: Record<string, string> = { Accept: "text/html" }
      const init: RequestInit = { credentials: "include", headers }
      if (sections) {
        headers["Content-Type"] = "application/json"
        headers["X-CSRF-Token"] = await getCsrfToken()
        init.method = "POST"
        init.body = JSON.stringify({ sections })
      }
      const response = await fetch(`/admin/themes/${encodeURIComponent(selectedThemeId)}/preview`, init)
      const html = await response.text()
      if (!response.ok && response.status !== 404) throw new Error("Прегледът на темата не може да бъде зареден.")
      if (sequence === previewSequence.current) {
        const base = `<base href="${window.location.origin}/">`
        const withBase = html.replace(/<head([^>]*)>/i, `<head$1>${base}`)
        const nextHtml = withBase.includes("data-flex-preview-bridge")
          ? withBase
          : withBase.replace(/<\/body>/i, `${PREVIEW_BRIDGE}</body>`)
        if (previewFrameReady.current) {
          pendingPreviewHtml.current = nextHtml
          previewFrame.current?.contentWindow?.postMessage({ type: "flex-theme-preview-update", html: nextHtml }, "*")
        } else if (!previewDocumentSet.current) {
          previewDocumentSet.current = true
          setPreviewHtml(nextHtml)
        } else {
          pendingPreviewHtml.current = nextHtml
        }
      }
    } catch (reason) {
      if (sequence === previewSequence.current)
        toast.error(reason instanceof Error ? reason.message : "Грешка при прегледа.")
    } finally {
      if (sequence === previewSequence.current) setPreviewBusy(false)
    }
  }, [selectedThemeId])

  const onPreviewChange = useCallback((sections: Record<string, unknown>) => {
    if (previewTimer.current !== null) window.clearTimeout(previewTimer.current)
    previewTimer.current = window.setTimeout(() => void renderPreview(sections), 300)
  }, [renderPreview])

  useEffect(() => {
    if (!selectedThemeId) return
    setPreviewHtml("")
    previewFrameReady.current = false
    previewDocumentSet.current = false
    pendingPreviewHtml.current = ""
    void renderPreview(null)
    return () => {
      if (previewTimer.current !== null) window.clearTimeout(previewTimer.current)
      previewSequence.current += 1
    }
  }, [selectedThemeId, renderPreview])

  useEffect(() => {
    let navigationSequence = 0
    function receivePreviewMessage(event: MessageEvent) {
      if (event.source !== previewFrame.current?.contentWindow) return
      if (event.data?.type === "flex-theme-preview-ready") {
        previewFrameReady.current = true
        if (pendingPreviewHtml.current) {
          previewFrame.current?.contentWindow?.postMessage({ type: "flex-theme-preview-update", html: pendingPreviewHtml.current }, "*")
        }
        return
      }
      if (event.data?.type !== "flex-theme-preview-navigate" || typeof event.data.url !== "string") return
      let target: URL
      try { target = new URL(event.data.url, window.location.origin) } catch { return }
      if (target.origin !== window.location.origin) return
      const sequence = ++navigationSequence
      void fetch(target.href, { credentials: "include", headers: { Accept: "text/html" } })
        .then(async (response) => {
          if (!response.ok) throw new Error("Страницата не може да бъде заредена в прегледа.")
          return response.text()
        })
        .then((html) => {
          if (sequence !== navigationSequence) return
          const withBase = html.replace(/<head([^>]*)>/i, `<head$1><base href="${window.location.origin}/">`)
          const nextHtml = withBase.includes("data-flex-preview-bridge")
            ? withBase
            : withBase.replace(/<\/body>/i, `${PREVIEW_BRIDGE}</body>`)
          previewFrame.current?.contentWindow?.postMessage({ type: "flex-theme-preview-navigate-response", html: nextHtml }, "*")
        })
        .catch((reason) => {
          if (sequence === navigationSequence) toast.error(reason instanceof Error ? reason.message : "Грешка при зареждане на страницата.")
        })
    }
    window.addEventListener("message", receivePreviewMessage)
    return () => window.removeEventListener("message", receivePreviewMessage)
  }, [])

  async function saveSettings() {
    setSaving(true)
    try {
      await saves.run({ id: selectedThemeId })
      setPanelDirty(false)
      toast.success("Настройките на темата са запазени.")
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Настройките не можаха да бъдат запазени.")
    } finally {
      setSaving(false)
    }
  }

  function selectTheme(themeId: string) {
    if (themeId === selectedThemeId) return
    if ((panelDirty || fileDirty) && !window.confirm("Имате незапазени промени. Да ги отхвърля ли?")) return
    setSelectedThemeId(themeId)
    setPanelDirty(false)
    setFileDirty(false)
  }

  return (
    <AdminShell title={t("Theme editor")} onLogout={onLogout} onNavigate={onNavigate} activeItem="Теми" loggingOut={loggingOut}>
      <div className={`theme-builder-page${expanded ? " is-fullscreen" : ""}${resizingPanel ? " is-resizing-panel" : ""}`} style={panelWidth === null ? undefined : { "--theme-builder-panel-width": `${panelWidth}px` } as CSSProperties}>
        <div className="react-page-heading theme-builder-heading">
          <div>
            <h1>{t("Theme editor")}</h1>
            <Breadcrumbs onHomeClick={() => onNavigate("Табло")} items={[{ label: "Themes", onClick: () => onNavigate("Теми") }, { label: t("Theme editor") }]} />
          </div>
          <div className="theme-builder-actions">
            <DropdownMenu
              ariaLabel={t("Choose a theme")}
              disabled={loadingThemes || themes.length === 0}
              triggerClassName="react-form-select theme-builder-theme-select"
              trigger={<><span>{loadingThemes ? t("Loading themes…") : selectedTheme?.name ?? (themes.length === 0 ? t("No installed themes") : t("Select a theme"))}</span><DropdownChevron /></>}
            >
              {themes.map((theme) => <DropdownOption key={theme.id} selected={selectedThemeId === theme.id} onClick={() => selectTheme(theme.id)}>{theme.name}{theme.active ? " · Активна" : ""}</DropdownOption>)}
            </DropdownMenu>
            {view === "builder" && selectedTheme?.active && panels.length > 0 && (
              <Button className="theme-builder-save-button" variant="primary" type="button" onClick={() => void saveSettings()} disabled={!panelDirty} loading={saving}><Save size={17} /> Запази</Button>
            )}
            <Button variant="secondary" type="button" onClick={toggleFullscreen} aria-label={expanded ? "Изход от цял екран" : "Разгъни редактора на цял екран"} title={expanded ? "Изход от цял екран" : "Цял екран на редактора"}>
              {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              {expanded ? "Изход от цял екран" : "Цял екран"}
            </Button>
            <div className="theme-builder-view-toggle" role="group" aria-label="Режим на редактора">
              <Button variant={view === "builder" ? "primary" : "secondary"} type="button" onClick={() => setView("builder")}><Eye size={17} /> Дизайн</Button>
              <Button variant={view === "files" ? "primary" : "secondary"} type="button" onClick={() => setView("files")}><Code2 size={17} /> Файлове</Button>
            </div>
          </div>
        </div>

        {!selectedTheme && !loadingThemes && <p role="status">Няма инсталирана тема за редактиране.</p>}

        {selectedTheme && view === "builder" && (
          <div className="theme-builder-workspace">
            <aside className="theme-builder-controls">
              <div className="theme-builder-panel-heading"><h2>Настройки на дизайна</h2><span>{selectedTheme.name}</span></div>
              {!selectedTheme.active && <p className="theme-builder-note">За да променяте съдържанието, активирайте темата. Прегледът остава достъпен.</p>}
              {selectedTheme.active && panels.length > 0 ? (
                <ExtensionScope value={extensionScope}>
                  {panels.map((panel) => <ExtensionComponent key={panel.id} descriptor={panel} context={panelContext} saves={saves} props={{ changed: () => setPanelDirty(true), previewChange: onPreviewChange }} />)}
                </ExtensionScope>
              ) : selectedTheme.active ? <p className="theme-builder-note">Активирайте „Flex Theme Content“ и добавете content_schema към theme.json, за да редактирате текстовете и настройките.</p> : null}
            </aside>
            <div
              className="theme-builder-resizer"
              role="separator"
              aria-label="Промяна на ширината на панела с настройки"
              aria-orientation="vertical"
              aria-valuemin={280}
              aria-valuemax={Math.max(320, typeof window === "undefined" ? 1200 : window.innerWidth - 400)}
              aria-valuenow={panelWidth ?? Math.round(window.innerWidth * 0.4)}
              tabIndex={0}
              onPointerDown={(event) => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                setResizingPanel(true)
                resizePanel(event.clientX)
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) resizePanel(event.clientX)
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
                setResizingPanel(false)
              }}
              onPointerCancel={() => setResizingPanel(false)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault()
                  const current = panelWidth ?? Math.round(window.innerWidth * 0.4)
                  resizePanel(current + (event.key === "ArrowRight" ? 16 : -16))
                } else if (event.key === "Home") {
                  event.preventDefault()
                  setPanelWidth(null)
                }
              }}
            >
              <GripVertical size={16} aria-hidden="true" />
            </div>
            <section className="theme-builder-preview" aria-label="Преглед на сайта">
              <div className="theme-builder-preview-toolbar">
                <span>{previewBusy ? "Обновяване на прегледа…" : "Преглед на живо"}</span>
                <div role="group" aria-label="Размер на прегледа" className="theme-builder-device-picker">
                  <button type="button" aria-label="Десктоп" aria-pressed={previewWidth === "desktop"} onClick={() => setPreviewWidth("desktop")}><Monitor size={17} /></button>
                  <button type="button" aria-label="Таблет" aria-pressed={previewWidth === "tablet"} onClick={() => setPreviewWidth("tablet")}><Tablet size={17} /></button>
                  <button type="button" aria-label="Телефон" aria-pressed={previewWidth === "mobile"} onClick={() => setPreviewWidth("mobile")}><Smartphone size={17} /></button>
                </div>
              </div>
              <div className={`theme-builder-canvas is-${previewWidth}`}>
                {previewHtml ? <iframe ref={previewFrame} key={selectedTheme.id} title={`Преглед на тема ${selectedTheme.name}`} srcDoc={previewHtml} sandbox="allow-scripts allow-forms allow-popups" /> : <div className="theme-builder-loading">Зареждане на прегледа…</div>}
              </div>
            </section>
          </div>
        )}

        {selectedTheme && view === "files" && <ThemeSourceEditor key={selectedTheme.id} themeId={selectedTheme.id} onUnsavedChangesChange={setFileDirty} />}
      </div>
    </AdminShell>
  )
}
