import { useSyncExternalStore } from "react"
import { bgCatalog } from "./locales/bg"
import { enCatalog } from "./locales/en"

export type AdminLocale = string
export type AdminCatalog = Record<string, string>

const localeLabels: Record<string, string> = { en: "English", bg: "Български" }
const catalogs = new Map<string, Record<AdminLocale, AdminCatalog>>([
  ["core", { en: enCatalog, bg: bgCatalog }],
])
let currentLocale = "en"
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

export function getAdminLocale(): AdminLocale {
  return currentLocale
}

export function setAdminLocale(locale: AdminLocale): void {
  currentLocale = locale
  if (typeof document !== "undefined") document.documentElement.lang = locale
  notify()
}

export function useAdminLocale(): AdminLocale {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getAdminLocale,
    () => "en",
  )
}

function getSourceKey(source: string, namespace: string): string {
  if (namespace !== "core" || enCatalog[source]) return source

  // Existing core components still pass Bulgarian strings to t(). Resolve them
  // through the English-keyed Bulgarian catalog during the gradual migration.
  return Object.entries(bgCatalog).find(([, translation]) => translation === source)?.[0] ?? source
}

export function t(
  source: string,
  namespace = "core",
  variables: Record<string, string | number> = {},
): string {
  const sourceKey = getSourceKey(source, namespace)
  const catalogByLocale = catalogs.get(namespace)
  const localeCatalog = catalogByLocale?.[currentLocale]
    ?? catalogByLocale?.[currentLocale.split("-")[0]]
  const direct = localeCatalog?.[sourceKey]
  if (direct) return interpolate(direct, variables)

  const englishFallback = catalogByLocale?.en?.[sourceKey]
  if (englishFallback) return interpolate(englishFallback, variables)

  for (const [registeredNamespace, translations] of catalogs) {
    if (registeredNamespace === namespace) continue
    const translated = translations[currentLocale]?.[sourceKey]
      ?? translations[currentLocale.split("-")[0]]?.[sourceKey]
    if (translated) return interpolate(translated, variables)
  }

  return interpolate(sourceKey, variables)
}

function interpolate(message: string, variables: Record<string, string | number>): string {
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(variables, name) ? String(variables[name]) : placeholder,
  )
}

/** Registers English-keyed admin translations for a theme or plugin namespace. */
export function registerAdminTranslations(
  namespace: string,
  translations: Record<AdminLocale, AdminCatalog>,
): void {
  const current = catalogs.get(namespace) ?? {}
  catalogs.set(namespace, { ...current, ...translations })
  notify()
}

/** Adds a language to the profile picker. Locale codes follow BCP 47, for example "de" or "pt-BR". */
export function registerAdminLocale(locale: string, label: string): void {
  if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale) || locale.length > 16 || !label.trim()) return
  localeLabels[locale] = label.trim()
  notify()
}

export function getAdminLocales(): Array<{ code: string; label: string }> {
  return Object.entries(localeLabels).map(([code, label]) => ({ code, label }))
}
