import { useSyncExternalStore } from "react"
import { arCatalog } from "./locales/ar"
import { bgCatalog } from "./locales/bg"
import { bnCatalog } from "./locales/bn"
import { csCatalog } from "./locales/cs"
import { deCatalog } from "./locales/de"
import { elCatalog } from "./locales/el"
import { enCatalog } from "./locales/en"
import { esCatalog } from "./locales/es"
import { frCatalog } from "./locales/fr"
import { hiCatalog } from "./locales/hi"
import { huCatalog } from "./locales/hu"
import { idCatalog } from "./locales/id"
import { itCatalog } from "./locales/it"
import { jaCatalog } from "./locales/ja"
import { mkCatalog } from "./locales/mk"
import { mrCatalog } from "./locales/mr"
import { nlCatalog } from "./locales/nl"
import { paCatalog } from "./locales/pa"
import { plCatalog } from "./locales/pl"
import { ptCatalog } from "./locales/pt"
import { roCatalog } from "./locales/ro"
import { ruCatalog } from "./locales/ru"
import { svCatalog } from "./locales/sv"
import { taCatalog } from "./locales/ta"
import { teCatalog } from "./locales/te"
import { trCatalog } from "./locales/tr"
import { ukCatalog } from "./locales/uk"
import { urCatalog } from "./locales/ur"
import { viCatalog } from "./locales/vi"
import { zhCNcatalog } from "./locales/zh-CN"

export type AdminLocale = string
export type AdminCatalog = Record<string, string>
export type AdminTranslationOverrides = Record<string, Record<string, AdminCatalog>>

const localeLabels: Record<string, string> = {
  en: "English",
  bg: "Български",
  ro: "Română",
  el: "Ελληνικά",
  tr: "Türkçe",
  mk: "Македонски",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  ru: "Русский",
  uk: "Українська",
  sv: "Svenska",
  cs: "Čeština",
  hu: "Magyar",
  "zh-CN": "简体中文",
  hi: "हिन्दी",
  ar: "العربية",
  bn: "বাংলা",
  ur: "اردو",
  id: "Bahasa Indonesia",
  ja: "日本語",
  pa: "ਪੰਜਾਬੀ",
  mr: "मराठी",
  te: "తెలుగు",
  ta: "தமிழ்",
  vi: "Tiếng Việt",
}
const catalogs = new Map<string, Record<AdminLocale, AdminCatalog>>([
  ["core", {
    en: enCatalog,
    bg: bgCatalog,
    ro: roCatalog,
    el: elCatalog,
    tr: trCatalog,
    mk: mkCatalog,
    fr: frCatalog,
    de: deCatalog,
    es: esCatalog,
    it: itCatalog,
    pt: ptCatalog,
    nl: nlCatalog,
    pl: plCatalog,
    ru: ruCatalog,
    uk: ukCatalog,
    sv: svCatalog,
    cs: csCatalog,
    hu: huCatalog,
    "zh-CN": zhCNcatalog,
    hi: hiCatalog,
    ar: arCatalog,
    bn: bnCatalog,
    ur: urCatalog,
    id: idCatalog,
    ja: jaCatalog,
    pa: paCatalog,
    mr: mrCatalog,
    te: teCatalog,
    ta: taCatalog,
    vi: viCatalog,
  }],
])
let currentLocale = "en"
let translationOverrides: AdminTranslationOverrides = {}
let storeRevision = 0
const listeners = new Set<() => void>()

function notify() {
  storeRevision += 1
  listeners.forEach((listener) => listener())
}

export function getAdminLocale(): AdminLocale {
  return currentLocale
}

export function setAdminLocale(locale: AdminLocale): void {
  currentLocale = locale
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale
    document.documentElement.dir = locale.toLowerCase().startsWith("ar") ? "rtl" : "ltr"
  }
  notify()
}

export function useAdminLocale(): AdminLocale {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => storeRevision,
    () => 0,
  )
  return currentLocale
}

export function getPackagedAdminTranslationCatalog(locale: AdminLocale): Record<string, AdminCatalog> {
  const baseLocale = locale.split("-")[0]
  const catalog: Record<string, AdminCatalog> = {}
  for (const [namespace, translations] of catalogs) {
    catalog[namespace] = {
      ...(translations.en ?? {}),
      ...(translations[locale] ?? translations[baseLocale] ?? {}),
    }
  }
  return catalog
}

export function getAdminTranslationCatalog(locale: AdminLocale): Record<string, AdminCatalog> {
  const catalog = getPackagedAdminTranslationCatalog(locale)
  for (const [namespace, entries] of Object.entries(
    translationOverrides[locale] ?? translationOverrides[locale.split("-")[0]] ?? {},
  )) {
    catalog[namespace] = { ...(catalog[namespace] ?? {}), ...entries }
  }
  return catalog
}

export function getAdminTranslationOverrides(): AdminTranslationOverrides {
  return translationOverrides
}

export function setAdminTranslationOverrides(overrides: AdminTranslationOverrides): void {
  translationOverrides = overrides && typeof overrides === "object" ? overrides : {}
  notify()
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
  const localeOverride = translationOverrides[currentLocale]?.[namespace]
    ?? translationOverrides[currentLocale.split("-")[0]]?.[namespace]
  if (localeOverride && Object.hasOwn(localeOverride, sourceKey))
    return interpolate(localeOverride[sourceKey], variables)
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
