import Alpine from "alpinejs"
import $ from "jquery"
import "@fontsource-variable/geist"

import { actionDropdownMarkup, dataTableMarkup, registerDataTable } from "@/components/data-table"
import { breadcrumbsMarkup } from "@/components/breadcrumbs"
import { collapsibleTextMarkup } from "@/components/collapsible-text"
import { fieldHintMarkup } from "@/components/field-hint"
import { registerRichTextEditor, richTextEditorMarkup } from "@/components/rich-text-editor"
import { showToast } from "@/components/toast"
import { confirmModalMarkup } from "@/components/confirm-modal"
import { filterModalMarkup } from "@/components/filter-modal"
import { bulkActionModalMarkup } from "@/components/bulk-action-modal"
import { codeEditorMarkup, registerCodeEditor } from "@/components/code-editor"
import { pageFormSchema, slugifyPageTitle } from "@/lib/page-validation"
import "@/styles/globals.css"

function contentBlocksMarkup(): string {
  return pluginPageFieldsMarkup("pageFields", "pluginFields")
}

type PageField = {
  plugin: string
  id: string
  type: "text" | "textarea" | "checkbox"
  label: string
  default: string | boolean
  hint: string
}

function pluginPageFieldsMarkup(fieldsExpression = "pageFields", valuesExpression = "pluginFields"): string {
  return `<template x-for="pluginId in [...new Set(${fieldsExpression}.map((field) => field.plugin))]" :key="pluginId"><section class="plugin-fields-group"><header class="plugin-fields-group-header"><div><h2 class="plugin-fields-group-title" x-text="plugins.find((plugin) => plugin.id === pluginId)?.name || pluginId"></h2><p class="plugin-fields-group-source"><span>Добавено от плъгин</span><strong x-text="plugins.find((plugin) => plugin.id === pluginId)?.version ? 'v' + plugins.find((plugin) => plugin.id === pluginId).version : pluginId"></strong></p></div><span class="plugin-source-badge">Плъгин</span></header><div class="plugin-fields-group-body"><template x-for="field in ${fieldsExpression}.filter((item) => item.plugin === pluginId)" :key="field.plugin + '.' + field.id"><div class="plugin-field-item"><template x-if="field.type !== 'checkbox'"><label><span class="field-label" x-text="field.label"></span><template x-if="field.type === 'textarea'"><textarea class="form-control" x-model="${valuesExpression}[field.plugin][field.id]" :maxlength="1000"></textarea></template><template x-if="field.type === 'text'"><input class="form-control" type="text" x-model="${valuesExpression}[field.plugin][field.id]" :maxlength="190"></template><span class="field-hint-text" x-show="field.hint" x-text="field.hint"></span></label></template><template x-if="field.type === 'checkbox'"><label class="checkbox-field"><input type="checkbox" x-model="${valuesExpression}[field.plugin][field.id]"><span x-text="field.label"></span><span class="field-hint-text" x-show="field.hint" x-text="field.hint"></span></label></template></div></template></div></section></template>`
}

function pluginSettingsMarkup(): string {
  return pluginPageFieldsMarkup("pageSettingsFields", "pluginSettings")
}

function pageFieldDefaults(fields: PageField[]): Record<string, Record<string, string | boolean>> {
  return fields.reduce<Record<string, Record<string, string | boolean>>>((values, field) => {
    values[field.plugin] ??= {}
    values[field.plugin][field.id] = field.default
    return values
  }, {})
}

function pageFieldValues(fields: PageField[], values?: Record<string, Record<string, string | boolean>>): Record<string, Record<string, string | boolean>> {
  const result = pageFieldDefaults(fields)
  for (const [plugin, pluginValues] of Object.entries(values ?? {})) result[plugin] = { ...result[plugin], ...pluginValues }
  return result
}

type PageRecord = {
  id: number
  title: string
  slug: string
  content: string
  blocks?: ContentBlock[]
  status: "draft" | "published"
  published_at: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at?: string | null
  parent_id?: number | null
  depth?: number
  settings?: PageSettings
  plugin_fields?: Record<string, Record<string, string | boolean>>
  plugin_settings?: Record<string, Record<string, string | boolean>>
}

type PageSettings = {
  seo_title: string
  meta_description: string
  canonical_url: string
  template: "default" | "full_width" | "landing"
  menu_order: number
  use_parent_slugs: boolean
  no_index: boolean
  show_in_navigation: boolean
  show_in_sitemap: boolean
}

type ContentBlock = {
  type: "paragraph" | "heading" | "image" | "button"
  data: Record<string, string>
}

type PluginRecord = {
  id: string
  name: string
  version: string
  description: string
  entrypoint: string
  path: string
  status: "discovered" | "installed" | "inactive" | "active" | "error"
  source?: "catalog" | "local"
  installed_at: string | null
  activated_at: string | null
  last_error: string | null
  requested_permissions?: string[]
  approved_permissions?: string[]
  manifest?: Record<string, unknown>
  last_update_id?: string | null
  last_update_from?: string | null
  last_update_to?: string | null
}

type ThemeRecord = {
  id: string
  name: string
  version: string
  author: string
  description: string
  path: string
  active: boolean
  valid: boolean
  error: string | null
  available_version?: string
  update_available?: boolean
  release_notes?: string
}

type ThemeCatalogRecord = {
  id: string
  name: string
  description: string
  author: string
  version: string
  published_at: string
  release_notes: string
  size: number
  minimum_php: string
  compatible_from: string
  installed: boolean
  installed_version: string | null
  active: boolean
  installation_status: "not_installed" | "installed" | "active"
}

type Bootstrap = {
  page: "dashboard" | "updates" | "profile" | "users" | "users-create" | "users-edit" | "pages" | "pages-create" | "pages-edit" | "pages-settings" | "themes" | "theme-catalog" | "plugins" | "plugin-catalog" | "plugin-detail" | "plugin-catalog-detail"
  csrfToken: string
  sidebarWidth: number
  sidebarCollapsed?: boolean
  collapsedSections?: Record<string, boolean>
  version: string
  users?: number
  userList?: Array<{ id: number; name: string; email: string; role: string; status: string }>
  userData?: { id: number; name: string; email: string; role: string; status: string } | null
  user?: { name: string; email: string; role: string; status: string }
  pages?: PageRecord[]
  trashedPages?: PageRecord[]
  pageData?: PageRecord | null
  history?: Array<Record<string, string | boolean | undefined>>
  notice?: string | null
  error?: string | null
  inspection?: { version?: string; files?: number; migrations?: boolean } | null
  remoteUpdate?: { current_version: string; channel: string; error: string | null; available: { version: string; release_notes: string; size: number; published_at: string; channel: string } | null }
  updateJobs?: Array<{ id: string; type: string; status: string; created_at: string; started_at: string | null; finished_at: string | null; error: string | null; result: Record<string, unknown> }>
  plugins?: PluginRecord[]
  themes?: ThemeRecord[]
  themeCatalog?: ThemeCatalogRecord[]
  pluginCatalog?: Array<{ id: string; name: string; description: string; author: string; icon_url: string; version: string; release_notes: string; size: number; published_at: string; compatible_from: string; minimum_php: string; minimum_platform_version: string; permissions: string[]; installation_status: "not_installed" | "installed" | "active"; installed_version: string | null; update_available: boolean }>
  pluginDetail?: PluginRecord | null
  catalogDetail?: Bootstrap["pluginCatalog"] extends Array<infer T> ? T | null : null
  adminExtensions?: {
    sidebar: Array<{ id: string; label: string; href: string }>
    slots: Record<string, Array<{ kind: "notice" | "card" | "link"; title: string; text: string; href: string | null }>>
  }
  pageFields?: PageField[]
  pageSettingsFields?: PageField[]
}

type FieldErrors = Partial<Record<"title" | "slug" | "parent_id" | "status", string>>
type PageStatusFilter = "all" | "draft" | "published"
type PageStructureFilter = "all" | "root" | "child"
type PageViewFilter = "active" | "trash"

type PageFilters = {
  status: PageStatusFilter
  structure: PageStructureFilter
  view: PageViewFilter
}

type UserRoleFilter = "all" | "user" | "editor" | "admin" | "super_admin"
type UserStatusFilter = "all" | "active" | "disabled"

type UserFilters = {
  role: UserRoleFilter
  status: UserStatusFilter
}

const root = document.getElementById("flex-admin-root")
const bootstrapElement = document.getElementById("flex-admin-bootstrap")

function readBootstrap(): Bootstrap | null {
  if (!bootstrapElement) return null
  try {
    return JSON.parse(bootstrapElement.textContent ?? "{}") as Bootstrap
  } catch {
    return null
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character)
}

function readPageFiltersFromUrl(): PageFilters {
  const params = new URLSearchParams(window.location.search)
  const status = params.get("status")
  const structure = params.get("structure")
  const view = params.get("view")

  return {
    status: status === "draft" || status === "published" ? status : "all",
    structure: structure === "root" || structure === "child" ? structure : "all",
    view: view === "trash" ? "trash" : "active",
  }
}

function writePageFiltersToUrl(filters: PageFilters): void {
  const url = new URL(window.location.href)
  if (filters.status === "all") url.searchParams.delete("status")
  else url.searchParams.set("status", filters.status)
  if (filters.structure === "all") url.searchParams.delete("structure")
  else url.searchParams.set("structure", filters.structure)
  if (filters.view === "active") url.searchParams.delete("view")
  else url.searchParams.set("view", filters.view)
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
}

function readUserFiltersFromUrl(): UserFilters {
  const params = new URLSearchParams(window.location.search)
  const role = params.get("role")
  const status = params.get("user_status")

  return {
    role: role === "user" || role === "editor" || role === "admin" || role === "super_admin" ? role : "all",
    status: status === "active" || status === "disabled" ? status : "all",
  }
}

function writeUserFiltersToUrl(filters: UserFilters): void {
  const url = new URL(window.location.href)
  if (filters.role === "all") url.searchParams.delete("role")
  else url.searchParams.set("role", filters.role)
  if (filters.status === "all") url.searchParams.delete("user_status")
  else url.searchParams.set("user_status", filters.status)
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
}

function sectionHeader(title: string, key: string, expression?: string): string {
  const titleAttributes = expression ? ` x-text="${expression}"` : ""
  return `<button class="section-header" data-section-key="${key}" type="button" @click="toggleSection('${key}', $el)" :aria-expanded="!isSectionCollapsed('${key}')"><span${titleAttributes}>${title}</span><svg class="section-chevron" :class="{ 'is-collapsed': isSectionCollapsed('${key}') }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>`
}

function statusBadgeMarkup(expression: string): string {
  return `<span class="status-badge" :class="'status-badge-' + String(${expression})" x-text="statusLabel(${expression})"></span>`
}

function dropdownMarkup(model: string, options: Array<{ value: string; label: string }>, onChange?: string, afterMarkup = ""): string {
  const optionMap = Object.fromEntries(options.map((option) => [option.value, option.label]))
  const optionMapExpression = JSON.stringify(optionMap).replace(/"/g, "&quot;")
  const changeAction = onChange ? `; ${onChange}` : ""
  const optionMarkup = options.map((option) => `<button class="dropdown-option" type="button" @click="${model} = '${option.value}'; value = '${option.value}'; open = false${changeAction}" :class="{ 'is-selected': ${model} === '${option.value}' }">${option.label}</button>`).join("")

  const defaultValue = options[0]?.value ?? ""
  return `<div class="custom-dropdown" x-data="{ open: false, value: null, menuStyle: '', placement: 'bottom', reposition() { const rect = $refs.trigger.getBoundingClientRect(); const desired = Math.min(256, ${options.length} * 48 + 8); const gap = 4; const below = window.innerHeight - rect.bottom - gap; const above = rect.top - gap; const opensAbove = below < desired && above > below; const available = Math.max(96, opensAbove ? above : below); const height = Math.min(desired, available); this.placement = opensAbove ? 'top' : 'bottom'; this.menuStyle = \`left: \${rect.left}px; top: \${opensAbove ? rect.top - height - gap : rect.bottom + gap}px; width: \${rect.width}px; max-height: \${height}px;\`; } }" x-init="if (!${model}) ${model} = '${defaultValue}'; value = ${model}" @click.outside="open = false" @keydown.escape.window="open = false" @resize.window="if (open) reposition()" @scroll.window="if (open) reposition()"><button x-ref="trigger" class="form-control dropdown-trigger" type="button" data-slot="select-trigger" @click="open = !open; if (open) $nextTick(() => reposition())" :aria-expanded="open"><span x-text="${optionMapExpression}[${model}] ?? ''"></span><svg class="dropdown-chevron" :class="{ 'is-open': open }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button><template x-teleport="body"><div class="dropdown-menu" @click.stop :data-placement="placement" :style="menuStyle" x-show="open" x-transition:enter="dropdown-transition" x-transition:enter-start="dropdown-transition-start" x-transition:enter-end="dropdown-transition-end" x-transition:leave="dropdown-transition" x-transition:leave-start="dropdown-transition-end" x-transition:leave-end="dropdown-transition-start">${optionMarkup}</div></template></div>${afterMarkup}`
}

function parentDropdownMarkup(): string {
  return `<div class="page-parent-status-grid"><label><span class="field-label">Родителска страница${fieldHintMarkup("Изберете родителска страница, ако тази страница трябва да бъде подчинена на друга.")}</span><div class="custom-dropdown" x-data="{ open: false, value: null, menuStyle: '', reposition() { const rect = $refs.trigger.getBoundingClientRect(); const optionCount = pages.filter((option) => option.id !== editingId).length + 1; const desired = Math.min(256, optionCount * 48 + 8); const gap = 4; const below = window.innerHeight - rect.bottom - gap; const above = rect.top - gap; const opensAbove = below < desired && above > below; const available = Math.max(96, opensAbove ? above : below); const height = Math.min(desired, available); this.placement = opensAbove ? 'top' : 'bottom'; this.menuStyle = \`left: \${rect.left}px; top: \${opensAbove ? rect.top - height - gap : rect.bottom + gap}px; width: \${rect.width}px; max-height: \${height}px;\`; }, placement: 'bottom' }" x-modelable="value" x-model="form.parentId" @click.outside="open = false" @keydown.escape.window="open = false" @resize.window="if (open) reposition()" @scroll.window="if (open) reposition()"><button x-ref="trigger" class="form-control dropdown-trigger" type="button" data-slot="select-trigger" @click="open = !open; if (open) $nextTick(() => reposition())" :aria-expanded="open"><span x-text="value ? (pages.find((option) => String(option.id) === String(value)) ? ('— '.repeat(pages.find((option) => String(option.id) === String(value)).depth ?? 0) + pages.find((option) => String(option.id) === String(value)).title) : '') : 'Няма родителска страница'"></span><svg class="dropdown-chevron" :class="{ 'is-open': open }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button><template x-teleport="body"><div class="dropdown-menu" @click.stop :data-placement="placement" :style="menuStyle" x-show="open" x-transition:enter="dropdown-transition" x-transition:enter-start="dropdown-transition-start" x-transition:enter-end="dropdown-transition-end" x-transition:leave="dropdown-transition" x-transition:leave-start="dropdown-transition-end" x-transition:leave-end="dropdown-transition-start"><button class="dropdown-option" type="button" @click="value = ''; open = false">Няма родителска страница</button><template x-for="option in pages" :key="option.id"><button class="dropdown-option" type="button" x-show="option.id !== editingId" @click="value = option.id; open = false" :class="{ 'is-selected': String(value) === String(option.id) }" x-text="'— '.repeat(option.depth ?? 0) + option.title"></button></template></div></template></div><span class="field-error" x-show="fieldErrors.parent_id" x-text="fieldErrors.parent_id"></span></label>`
}

function adminSlotMarkup(name: string): string {
  return `<div class="admin-extension-slot" x-show="(adminExtensions.slots['${name}'] || []).length"><template x-for="item in (adminExtensions.slots['${name}'] || [])" :key="item.kind + item.title"><div x-show="item.kind === 'notice'" class="notice info"><strong x-text="item.title"></strong><span x-text="item.text"></span></div><article x-show="item.kind === 'card'" class="content-card admin-extension-card"><h2 x-text="item.title"></h2><p x-text="item.text"></p></article><a x-show="item.kind === 'link'" class="admin-extension-link" :href="item.href" @click.prevent="navigate(item.href)"><strong x-text="item.title"></strong><span x-text="item.text"></span></a></template></div>`
}

function adminSidebarMarkup(): string {
  return `<template x-for="item in adminExtensions.sidebar" :key="item.id"><li><a class="sidebar-link" :href="item.href" @click.prevent="navigate(item.href)"><span class="sidebar-link-label" x-text="item.label"></span></a></li></template>`
}

function catalogPluginDetailMarkup(): string {
  return `<template x-if="page === 'plugin-catalog-detail'"><section><div class="page-heading-row"><div><h1 x-text="selectedCatalogPlugin()?.name || selectedCatalogPlugin()?.id || 'Детайли на разширение'"></h1>${breadcrumbsMarkup("selectedCatalogPlugin()?.name || 'Каталог с разширения'", [{ label: "Каталог с разширения", href: "/admin/plugins/catalog" }])}</div><div class="page-heading-actions"><button class="button secondary" type="button" @click="navigate('/admin/plugins/catalog')">Назад към каталога</button><button class="button primary" type="button" x-show="selectedCatalogPlugin()?.installation_status === 'not_installed'" :disabled="!selectedCatalogPlugin() || pluginBusy === selectedCatalogPlugin()?.id" @click="selectedCatalogPlugin() && installRemotePlugin(selectedCatalogPlugin())" x-text="'Инсталирай ' + (selectedCatalogPlugin()?.name || selectedCatalogPlugin()?.id || '')"></button><button class="button primary" type="button" x-show="selectedCatalogPlugin()?.update_available" :disabled="pluginBusy === selectedCatalogPlugin()?.id" @click="selectedCatalogPlugin() && updateRemotePlugin(selectedCatalogPlugin())">Обнови плъгина</button></div></div><div class="plugin-detail-grid"><section class="content-card"><header>${sectionHeader("Основна информация", "plugin-catalog-info")}</header><div class="section-body plugin-detail-list" x-show="!isSectionCollapsed('plugin-catalog-info')"><div><span>ID</span><strong x-text="selectedCatalogPlugin()?.id || '—'"></strong></div><div><span>Версия в каталога</span><strong x-text="selectedCatalogPlugin()?.version || '—'"></strong></div><div><span>Инсталирана версия</span><strong x-text="selectedCatalogPlugin()?.installed_version || 'Не е инсталиран'"></strong></div><div><span>Автор</span><strong x-text="selectedCatalogPlugin()?.author || '—'"></strong></div><div><span>Размер</span><strong x-text="selectedCatalogPlugin()?.size ? Math.round(selectedCatalogPlugin().size / 1024) + ' KB' : '—'"></strong></div><div><span>Състояние</span><span class="status-badge" :class="'status-badge-' + (selectedCatalogPlugin()?.installation_status || 'not_installed')" x-text="statusLabel(selectedCatalogPlugin()?.installation_status || 'not_installed')"></span></div></div></section><section class="content-card"><header>${sectionHeader("Изисквания и разрешения", "plugin-catalog-requirements")}</header><div class="section-body plugin-catalog-requirements" x-show="!isSectionCollapsed('plugin-catalog-requirements')"><p class="field-hint">Проверете изискванията и разрешенията преди инсталиране.</p><div class="plugin-requirement-list"><div><span>Минимален PHP</span><strong x-text="selectedCatalogPlugin()?.minimum_php || '—'"></strong></div><div><span>Минимална версия на Flex CMS</span><strong x-text="selectedCatalogPlugin()?.minimum_platform_version || 'няма'"></strong></div><div><span>Съвместимост</span><strong x-text="selectedCatalogPlugin()?.compatible_from || '—'"></strong></div><div><span>Разрешения</span><div class="plugin-permission-list"><template x-for="permission in (selectedCatalogPlugin()?.permissions || [])" :key="permission"><span class="status-badge status-badge-installed" x-text="permission"></span></template><span class="table-cell-secondary" x-show="!(selectedCatalogPlugin()?.permissions || []).length">Няма специални разрешения.</span></div></div></div></div></section><section class="content-card"><header>${sectionHeader("Описание и release бележки", "plugin-catalog-notes")}</header><div class="section-body plugin-catalog-notes" x-show="!isSectionCollapsed('plugin-catalog-notes')"><p x-text="selectedCatalogPlugin()?.description || 'Няма описание.'"></p><p class="field-hint" x-text="'Версия ' + (selectedCatalogPlugin()?.version || '—') + ' · Публикувана: ' + (selectedCatalogPlugin()?.published_at || '—') + ' · Размер: ' + (selectedCatalogPlugin()?.size ? Math.round(selectedCatalogPlugin().size / 1024) + ' KB' : '—')"></p><p x-text="selectedCatalogPlugin()?.release_notes || 'Няма release бележки.'"></p></div></section></div></section></template>`
}

function pluginsPageMarkup(): string {
  const actions = actionDropdownMarkup('<button class="dropdown-option" type="button" x-show="row.status === \'discovered\' || row.status === \'error\'" :disabled="pluginBusy === row.id" @click="pluginAction(\'install\', row)" x-text="pluginBusy === row.id ? \'Изпълнение…\' : \'Инсталирай\'"></button><button class="dropdown-option" type="button" x-show="row.status === \'installed\' || row.status === \'inactive\'" :disabled="pluginBusy === row.id" @click="pluginAction(\'activate\', row)" x-text="pluginBusy === row.id ? \'Изпълнение…\' : \'Активирай\'"></button><button class="dropdown-option" type="button" x-show="row.status === \'active\'" :disabled="pluginBusy === row.id" @click="pluginAction(\'deactivate\', row)" x-text="pluginBusy === row.id ? \'Изпълнение…\' : \'Деактивирай\'"></button><button class="dropdown-option" type="button" x-show="row.status === \'inactive\' || row.status === \'installed\' || row.status === \'error\'" :disabled="pluginBusy === row.id" @click="pluginAction(\'uninstall\', row)">Премахни</button>')
  return `<template x-if="page === 'plugins'"><section><div class="page-heading-row"><div><h1>Разширения</h1>${breadcrumbsMarkup("'Разширения'")}${collapsibleTextMarkup("Тук управлявате всички разширения на Flex CMS. От тази таблица можете да преглеждате инсталираните и откритите плъгини, да отваряте подробната им информация, да ги инсталирате, активирате, деактивирате или премахвате.")}</div><div class="page-heading-actions"><button class="button primary" type="button" @click="navigate('/admin/plugins/catalog')">Каталог с разширения</button></div></div><div class="notice error" x-show="error" x-text="error"></div><div class="content-card plugin-install-card"><header>${sectionHeader("Добавяне на разширение", "plugins-install")}</header><div class="section-body" x-show="!isSectionCollapsed('plugins-install')"><div class="plugin-install-grid"><form @submit.prevent="uploadPlugin($event)"><label><span class="field-label">Качване от компютъра</span><input class="form-control" type="file" accept=".zip,application/zip" x-ref="pluginUpload" required><span class="field-hint-text">Изберете ZIP пакет с валиден plugin.json.</span></label><button class="button primary" type="submit" :disabled="pluginUploadBusy" x-text="pluginUploadBusy ? 'Инсталиране…' : 'Качи и инсталирай'"></button></form></div></div></div>${adminSlotMarkup("admin.plugins.before")}<div class="pages-table">${dataTableMarkup("plugins", [{ key: "name", label: "Име", sortable: true, linkTemplate: "/admin/plugins/{id}" }, { key: "description", label: "Описание", sortable: true }, { key: "id", label: "ID", sortable: true }, { key: "version", label: "Версия", sortable: true }, { key: "status", label: "Статус", sortable: true }], actions)}</div>${adminSlotMarkup("admin.plugins.after")}</section></template>`
}

function themesPageMarkup(): string {
  const actions = actionDropdownMarkup('<a class="dropdown-option" :href="\'/admin/themes/\' + encodeURIComponent(theme.id) + \'/preview\'" target="_blank" rel="noopener">Преглед</a><button class="dropdown-option" type="button" x-show="theme.update_available" :disabled="themeBusy" @click="updateTheme(theme)" x-text="themeBusy === theme.id ? \'Обновяване…\' : \'Обнови\'"></button><button class="dropdown-option" type="button" x-show="!theme.active && theme.valid && !theme.update_available" :disabled="themeBusy" @click="activateTheme(theme)" x-text="themeBusy === theme.id ? \'Активиране…\' : \'Активирай\'"></button><button class="dropdown-option" type="button" x-show="theme.active" :disabled="themeBusy" @click="window.dispatchEvent(new CustomEvent(\'flexcms-theme-deactivate\', { detail: { id: theme.id } }))">Деактивирай</button><button class="dropdown-option dropdown-option-danger" type="button" x-show="!theme.active" :disabled="themeBusy" @click="deleteTheme(theme)">Изтрий</button>')
  return `<template x-if="page === 'themes'"><section><div class="page-heading-row"><div><h1>Теми</h1>${breadcrumbsMarkup("'Теми'")}${collapsibleTextMarkup("Управлявайте локално инсталираните теми и избирайте коя тема да бъде активна за публичната част на сайта.")}</div><div class="page-heading-actions"><button class="button secondary" type="button" @click="navigate('/admin/themes/catalog')">Каталог с теми</button><button class="button secondary" type="button" x-show="themes.some((theme) => theme.active)" @click="rollbackTheme()">Върни предходната тема</button></div></div><div class="notice error" x-show="error" x-text="error"></div><div class="pages-table table-wrapper"><table><thead><tr><th>Име</th><th>Инсталирана версия</th><th>Налична версия</th><th>Описание</th><th>Състояние</th><th>Действия</th></tr></thead><tbody><template x-for="theme in themes" :key="theme.id"><tr><td><strong x-text="theme.name"></strong><small class="table-cell-secondary" x-text="theme.id"></small></td><td x-text="theme.version"></td><td><strong x-show="theme.available_version" x-text="theme.available_version"></strong><span class="table-cell-secondary" x-show="!theme.available_version">Няма данни</span></td><td><span x-text="theme.description || '—'"></span><small class="table-cell-secondary" x-show="theme.error" x-text="theme.error"></small></td><td><span class="status-badge" :class="theme.update_available ? 'status-badge-warning' : (theme.active ? 'status-badge-active' : (theme.valid ? 'status-badge-installed' : 'status-badge-error'))" x-text="theme.update_available ? 'Има обновяване' : (theme.active ? 'Активна' : (theme.valid ? 'Готова' : 'Невалидна'))"></span></td><td>${actions}</td></tr></template><tr x-show="themes.length === 0"><td colspan="6" class="empty-state">Няма открити теми.</td></tr></tbody></table></div></section></template>`
}

function legacyThemesPageMarkup(): string {
  return `<template x-if="page === 'themes'"><section><div class="page-heading-row"><div><h1>Теми</h1>${breadcrumbsMarkup("'Теми'")}${collapsibleTextMarkup("Управлявайте локално инсталираните теми и избирайте коя тема да бъде активна за публичната част на сайта.")}</div><div class="page-heading-actions"><button class="button secondary" type="button" @click="navigate('/admin/themes/catalog')">Каталог с теми</button><button class="button secondary" type="button" x-show="themes.some((theme) => theme.active)" @click="rollbackTheme()">Върни предходната тема</button></div></div><div class="notice error" x-show="error" x-text="error"></div><div class="pages-table table-wrapper"><table><thead><tr><th>Име</th><th>Инсталирана версия</th><th>Налична версия</th><th>Описание</th><th>Състояние</th><th>Действия</th></tr></thead><tbody><template x-for="theme in themes" :key="theme.id"><tr><td><strong x-text="theme.name"></strong><small class="table-cell-secondary" x-text="theme.id"></small></td><td x-text="theme.version"></td><td><strong x-show="theme.available_version" x-text="theme.available_version"></strong><span class="table-cell-secondary" x-show="!theme.available_version">Няма данни</span></td><td><span x-text="theme.description || '—'"></span><small class="table-cell-secondary" x-show="theme.error" x-text="theme.error"></small></td><td><span class="status-badge" :class="theme.update_available ? 'status-badge-warning' : (theme.active ? 'status-badge-active' : (theme.valid ? 'status-badge-installed' : 'status-badge-error'))" x-text="theme.update_available ? 'Има обновяване' : (theme.active ? 'Активна' : (theme.valid ? 'Готова' : 'Невалидна'))"></span></td><td><a class="button secondary" :href="'/admin/themes/' + encodeURIComponent(theme.id) + '/preview'" target="_blank" rel="noopener">Преглед</a><button class="button secondary" type="button" x-show="theme.update_available" :disabled="themeBusy" @click="updateTheme(theme)" x-text="themeBusy === theme.id ? 'Обновяване…' : 'Обнови'"></button><button class="button secondary" type="button" x-show="!theme.active && theme.valid && !theme.update_available" :disabled="themeBusy" @click="activateTheme(theme)" x-text="themeBusy === theme.id ? 'Активиране…' : 'Активирай'"></button><button class="button secondary" type="button" x-show="theme.active" :disabled="themeBusy" @click="deactivateTheme(theme)">Деактивирай</button><button class="button danger" type="button" x-show="!theme.active" :disabled="themeBusy" @click="deleteTheme(theme)">Изтрий</button><span class="table-cell-secondary" x-show="theme.active && !theme.update_available">Текуща тема</span></td></tr></template><tr x-show="themes.length === 0"><td colspan="6" class="empty-state">Няма открити теми.</td></tr></tbody></table></div></section></template>`
  // Kept below temporarily as the source of the existing local-theme markup.
  return `<template x-if="page === 'themes'"><section><div class="page-heading-row"><div><h1>Теми</h1>${breadcrumbsMarkup("'Теми'")}${collapsibleTextMarkup("Управлявайте публичния дизайн на сайта. Локалните теми се показват отделно от всички публикувани теми в каталога.")}</div><div class="page-heading-actions"><button class="button secondary" type="button" x-show="themes.some((theme) => theme.active)" @click="rollbackTheme()">Върни предходната тема</button></div></div><div class="notice error" x-show="error" x-text="error"></div><div class="pages-table table-wrapper"><table><thead><tr><th>Име</th><th>Инсталирана версия</th><th>Налична версия</th><th>Описание</th><th>Състояние</th><th>Действия</th></tr></thead><tbody><template x-for="theme in themes" :key="theme.id"><tr><td><strong x-text="theme.name"></strong><small class="table-cell-secondary" x-text="theme.id"></small></td><td x-text="theme.version"></td><td><strong x-show="theme.available_version" x-text="theme.available_version"></strong><span class="table-cell-secondary" x-show="!theme.available_version">Няма данни</span></td><td><span x-text="theme.description || '—'"></span><small class="table-cell-secondary" x-show="theme.error" x-text="theme.error"></small></td><td><span class="status-badge" :class="theme.update_available ? 'status-badge-warning' : (theme.active ? 'status-badge-active' : (theme.valid ? 'status-badge-installed' : 'status-badge-error'))" x-text="theme.update_available ? 'Има обновяване' : (theme.active ? 'Активна' : (theme.valid ? 'Готова' : 'Невалидна'))"></span></td><td><a class="button secondary" :href="'/admin/themes/' + encodeURIComponent(theme.id) + '/preview'" target="_blank" rel="noopener">Преглед</a><button class="button secondary" type="button" x-show="theme.update_available" :disabled="themeBusy" @click="updateTheme(theme)" x-text="themeBusy === theme.id ? 'Обновяване…' : 'Обнови'"></button><button class="button secondary" type="button" x-show="!theme.active && theme.valid && !theme.update_available" :disabled="themeBusy" @click="activateTheme(theme)" x-text="themeBusy === theme.id ? 'Активиране…' : 'Активирай'"></button><span class="table-cell-secondary" x-show="theme.active && !theme.update_available">Текуща тема</span></td></tr></template><tr x-show="themes.length === 0"><td colspan="6" class="empty-state">Няма открити теми.</td></tr></tbody></table></div><section class="content-card theme-catalog-card"><header><h2>Каталог с теми</h2></header><div class="section-body"><div class="pages-table table-wrapper" x-show="themeCatalog.length"><table><thead><tr><th>Тема</th><th>Описание</th><th>Версия</th><th>Изисквания</th><th>Състояние</th></tr></thead><tbody><template x-for="item in themeCatalog" :key="item.id"><tr><td><strong x-text="item.name || item.id"></strong><small class="table-cell-secondary" x-text="item.id"></small></td><td x-text="item.description || '—'"></td><td><strong x-text="item.version"></strong><small class="table-cell-secondary" x-text="item.published_at"></small></td><td><span x-text="'PHP ' + (item.minimum_php || '—')"></span><small class="table-cell-secondary" x-text="'Flex CMS ' + (item.compatible_from || '—')"></small></td><td><span class="status-badge" :class="item.active ? 'status-badge-active' : (item.installed ? 'status-badge-installed' : 'status-badge-warning')" x-text="item.active ? 'Активна' : (item.installed ? 'Инсталирана' : 'Налична в каталога')"></span></td></tr></template></tbody></table></div><p class="empty-state" x-show="!themeCatalog.length">Каталогът не е достъпен или няма публикувани теми.</p></div></section></section></template>`
}

void legacyThemesPageMarkup

function themeCatalogPageMarkup(): string {
  return `<template x-if="page === 'theme-catalog'"><section><div class="page-heading-row"><div><h1>Каталог с теми</h1>${breadcrumbsMarkup("'Каталог с теми'", [{ label: "Теми", href: "/admin/themes" }])}${collapsibleTextMarkup("Разглеждайте публикуваните теми от конфигурирания HTTPS сървър. Тук виждате версията, автора, изискванията и състоянието на всяка тема за текущата инсталация.")}</div><div class="page-heading-actions"><button class="button secondary" type="button" @click="navigate('/admin/themes')">Назад към темите</button></div></div><div class="theme-catalog-grid" x-show="themeCatalog.length"><template x-for="item in themeCatalog" :key="item.id"><article class="theme-catalog-card"><div class="theme-card-preview"><span>Flex CMS</span><strong x-text="item.name || item.id"></strong></div><div class="theme-card-body"><div class="theme-card-heading"><div><h2 x-text="item.name || item.id"></h2><small class="table-cell-secondary" x-text="item.id"></small></div><span class="status-badge" :class="item.installation_status === 'active' ? 'status-badge-active' : (item.installation_status === 'installed' ? 'status-badge-installed' : 'status-badge-warning')" x-text="item.installation_status === 'active' ? 'Активна' : (item.installation_status === 'installed' ? 'Инсталирана' : 'Неинсталирана')"></span></div><p class="theme-card-description" x-text="item.description || 'Няма описание.'"></p><p class="theme-card-author" x-show="item.author" x-text="'От ' + item.author"></p><div class="theme-card-meta"><span>Версия <strong x-text="item.version"></strong></span><span x-text="'PHP ' + (item.minimum_php || '—')"></span><span x-text="'Flex CMS ' + (item.compatible_from || '—')"></span></div><div class="theme-card-footer"><span class="table-cell-secondary" x-text="item.installed ? ('Инсталирана: ' + item.installed_version) : 'Не е инсталирана'"></span><span class="table-cell-secondary" x-text="item.published_at ? 'Публикувана: ' + item.published_at : ''"></span><button class="button primary" type="button" x-show="item.installation_status === 'not_installed'" :disabled="themeBusy === item.id" @click="installRemoteTheme(item)" x-text="themeBusy === item.id ? 'Инсталиране…' : 'Инсталирай'"></button></div></div></article></template></div><p class="empty-state" x-show="!themeCatalog.length">Каталогът не е достъпен или няма публикувани теми.</p></section></template>`
}

function pluginCatalogPageMarkup(): string {
return `<template x-if="page === 'plugin-catalog'"><section><div class="page-heading-row"><div><h1>Каталог с разширения</h1>${breadcrumbsMarkup("'Каталог с разширения'", [{ label: "Разширения", href: "/admin/plugins" }])}${collapsibleTextMarkup("Разглеждайте публикуваните плъгини от конфигурирания HTTPS сървър. Отворете детайлите, прегледайте изискванията и инсталирайте избран плъгин директно в платформата.")}</div><div class="page-heading-actions"><button class="button secondary" type="button" @click="navigate('/admin/plugins')">Назад към разширенията</button></div></div><div class="table-wrapper plugin-catalog-table" x-show="pluginCatalog.length"><table><thead><tr><th>Плъгин</th><th>Описание</th><th>Версия</th><th>Състояние</th><th>Изисквания</th><th>Действие</th></tr></thead><tbody><template x-for="item in pluginCatalog" :key="item.id"><tr><td><a class="table-link" :href="'/admin/plugins/catalog/' + item.id" @click.prevent="navigate('/admin/plugins/catalog/' + encodeURI(item.id))" x-text="item.name || item.id"></a><small class="table-cell-secondary" x-text="item.id"></small></td><td x-text="item.description || '—'"></td><td><strong x-text="item.version"></strong><small class="table-cell-secondary" x-text="item.installed_version ? 'Инсталирана: ' + item.installed_version : 'Не е инсталиран'"></small></td><td><span class="status-badge" :class="'status-badge-' + item.installation_status" x-text="statusLabel(item.installation_status)"></span></td><td><span x-text="'PHP ' + (item.minimum_php || '—')"></span><small class="table-cell-secondary" x-text="item.minimum_platform_version ? 'Flex CMS ' + item.minimum_platform_version : 'Без минимална версия на платформата'"></small></td><td><button class="button secondary" type="button" x-show="item.installation_status === 'not_installed'" :disabled="pluginBusy === item.id" @click="installRemotePlugin(item)" x-text="pluginBusy === item.id ? 'Инсталиране…' : 'Инсталирай'"></button><button class="button secondary" type="button" x-show="item.update_available" :disabled="pluginBusy === item.id" @click="updateRemotePlugin(item)">Обнови</button><span class="table-cell-secondary" x-show="item.installation_status !== 'not_installed' && !item.update_available" x-text="statusLabel(item.installation_status)"></span></td></tr></template></tbody></table></div><p class="empty-state" x-show="!pluginCatalog.length">Каталогът не е достъпен или няма публикувани плъгини.</p></section></template>`
}

function remoteUpdatesMarkup(): string {
  return `<section class="content-card updates-remote-card"><header>${sectionHeader("Автоматични обновявания", "updates-remote")}</header><div class="section-body" x-show="!isSectionCollapsed('updates-remote')"><div class="update-summary"><p><strong>Текуща версия:</strong> <span x-text="remoteUpdate.current_version"></span></p><p><strong>Канал:</strong> <span x-text="remoteUpdate.channel"></span></p><p class="notice error" x-show="remoteUpdate.error" x-text="remoteUpdate.error"></p><template x-if="remoteUpdate.available"><div><p><strong>Налична версия:</strong> <span x-text="remoteUpdate.available.version"></span></p><p class="muted" x-text="remoteUpdate.available.release_notes || 'Няма допълнителни бележки към изданието.'"></p><p class="muted" x-text="'Публикувана: ' + remoteUpdate.available.published_at + ' · Размер: ' + Math.round(remoteUpdate.available.size / 1024 / 1024 * 10) / 10 + ' MB'"></p><form method="post" action="/admin/updates/remote"><input type="hidden" name="_token" :value="csrfToken"><button class="button primary" type="submit">Обнови сега</button></form></div></template><p x-show="!remoteUpdate.error && !remoteUpdate.available" class="muted">Няма налична съвместима версия за избрания канал.</p></div><div class="table-wrapper" x-show="updateJobs.length"><table><thead><tr><th>Заявка</th><th>Статус</th><th>Създадена</th><th>Грешка</th></tr></thead><tbody><template x-for="job in updateJobs" :key="job.id"><tr><td x-text="job.id"></td><td>${statusBadgeMarkup("job.status")}</td><td x-text="job.created_at"></td><td x-text="job.error || '—'"></td></tr></template></tbody></table></div></div></section>`
}

function adminMarkup(): string {
  const markup = `
    <div class="admin-shell sidebar-enhanced" x-data="adminApp" :class="{ 'sidebar-collapsed': collapsed, 'sidebar-mobile-open': mobileOpen }" :style="\`--sidebar-width: \${width}px\`"><div class="admin-loading-bar" x-show="loading" x-cloak></div>
      <aside id="admin-sidebar" class="admin-sidebar" :aria-hidden="isMobile && !mobileOpen">
        <div class="sidebar-brand"><img class="sidebar-logo" src="/assets/brand/logo.png" alt="Flex CMS"></div>
        <nav aria-label="Административна навигация"><ul class="sidebar-nav-list">
          <li class="sidebar-group-label">Основни</li>
          <li><a class="sidebar-link" href="/admin" :class="{ 'is-active': page === 'dashboard' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-8Z" /></svg><span class="sidebar-link-label">Табло</span></a></li>
          <li><a class="sidebar-link" href="/admin/pages" :class="{ 'is-active': page === 'pages' || page === 'pages-create' || page === 'pages-edit' || page === 'pages-settings' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Zm9 0v4h3M9 12h6M9 16h6M9 8h2" /></svg><span class="sidebar-link-label">Страници</span></a></li>
          <li><a class="sidebar-link" href="/admin/themes" :class="{ 'is-active': page === 'themes' || page === 'theme-catalog' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4V5Zm4 0v14M4 9h4M12 9h8M12 13h8M12 17h5" /></svg><span class="sidebar-link-label">Теми</span></a></li>
          <li class="sidebar-group-label">Управление</li>
          <li><a class="sidebar-link" href="/admin/users" :class="{ 'is-active': page === 'users' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 19a4 4 0 0 1 7 0" /></svg><span class="sidebar-link-label">Потребители</span></a></li>
          <li><a class="sidebar-link" href="/admin/plugins" :class="{ 'is-active': page === 'plugins' || page === 'plugin-catalog' || page === 'plugin-detail' || page === 'plugin-catalog-detail' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v4M16 3v4M5 8h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8Zm3 4h8M8 16h5" /></svg><span class="sidebar-link-label">Разширения</span></a></li>
          <li class="sidebar-group-label">Система</li>
          <li><a class="sidebar-link" href="/admin/updates" :class="{ 'is-active': page === 'updates' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.8-4M4 5v4h4M4 13a8 8 0 0 0 14.8 4M20 19v-4h-4" /></svg><span class="sidebar-link-label">Обновявания</span></a></li>
          <li class="sidebar-group-label">Акаунт</li>
          <li><a class="sidebar-link" href="/admin/profile" :class="{ 'is-active': page === 'profile' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg><span class="sidebar-link-label">Профил</span></a></li>
        </ul></nav>
      </aside>
      <button class="sidebar-backdrop" type="button" aria-label="Затвори страничната лента" x-show="mobileOpen" @click="mobileOpen = false"></button>
      <div class="admin-main">
        <header class="admin-topbar"><button class="sidebar-toggle" type="button" aria-label="Покажи или прибери страничната лента" @click="toggleSidebar" :aria-expanded="!collapsed || mobileOpen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button><div class="topbar-title" x-text="pageTitle"></div><div class="topbar-actions"><form method="post" action="/logout"><input type="hidden" name="_token" :value="csrfToken"><button class="logout" type="submit">Изход</button></form></div></header>
        <main class="admin-content">
          <template x-if="page === 'dashboard'"><section><h1>Административен панел</h1><p class="lead">Имате пълен достъп до системната администрация като супер администратор.</p><section class="dashboard-grid"><article class="content-card"><header>${sectionHeader("Потребители", "dashboard-users")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-users')"><strong class="dashboard-stat-value" x-text="users"></strong><p>Регистрирани потребители в системата.</p><a href="/api/users">Отвори API →</a></div></article><article class="content-card"><header>${sectionHeader("Обновявания", "dashboard-updates")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-updates')"><p>Проверка, инсталация и връщане на подписани platform пакети.</p><strong class="dashboard-version-value" x-text="version"></strong><a href="/admin/updates" @click.prevent="navigate('/admin/updates')">Отвори обновявания →</a></div></article><article class="content-card"><header>${sectionHeader("Версия на платформата", "dashboard-version")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-version')"><p>Текущата инсталирана версия на Flex CMS.</p><strong class="dashboard-version-value" x-text="version"></strong></div></article></section></section></template>
          ${themesPageMarkup()}
          <template x-if="page === 'profile'"><section>${breadcrumbsMarkup("'Профил'")}<h1>Профил</h1><p class="lead">Основни данни за текущия потребител.</p><section class="content-card profile-card"><header>${sectionHeader("Данни на потребителя", "profile-details")}</header><div class="section-body" x-show="!isSectionCollapsed('profile-details')"><dl class="profile-details"><div><dt>Име</dt><dd x-text="user.name"></dd></div><div><dt>Имейл</dt><dd x-text="user.email"></dd></div><div><dt>Роля</dt><dd x-text="user.role"></dd></div><div><dt>Статус</dt><dd>${statusBadgeMarkup("user.status")}</dd></div></dl></div></section><section class="content-card profile-card"><header>${sectionHeader("Настройки на темата", "profile-theme")}</header><div class="section-body" x-show="!isSectionCollapsed('profile-theme')"><label class="profile-setting"><span class="field-label">Тема на приложението${fieldHintMarkup("Изберете светла, тъмна или системна тема. При системна тема се използва настройката на операционната система.")}</span><select x-model="theme" @change="saveTheme"><option value="system">Системна</option><option value="light">Светла</option><option value="dark">Тъмна</option></select></label></div></section></section></template>
          <template x-if="page === 'plugins'"><section><div class="page-heading-row"><div><h1>Разширения</h1><p class="lead">Управлявайте разширенията, които добавят функционалност към Flex CMS.</p></div></div>${breadcrumbsMarkup("'Разширения'")}<div class="notice error" x-show="error" x-text="error"></div><div class="pages-table table-wrapper"><table><thead><tr><th>Име</th><th>ID</th><th>Версия</th><th>Статус</th><th>Действия</th></tr></thead><tbody><template x-for="plugin in plugins" :key="plugin.id"><tr><td><a class="table-link" :href="'/admin/plugins/' + plugin.id" x-text="plugin.name"></a><small class="table-cell-secondary" x-text="plugin.description"></small><small class="table-cell-secondary" x-show="plugin.last_error" x-text="plugin.last_error"></small></td><td x-text="plugin.id"></td><td x-text="plugin.version"></td><td>${statusBadgeMarkup("plugin.status")}</td><td class="table-actions"><button class="button secondary" type="button" x-show="plugin.status === 'discovered' || plugin.status === 'error'" :disabled="pluginBusy === plugin.id" @click="pluginAction('install', plugin)" x-text="pluginBusy === plugin.id ? 'Изпълнение…' : 'Инсталирай'"></button><button class="button secondary" type="button" x-show="plugin.status === 'installed' || plugin.status === 'inactive'" :disabled="pluginBusy === plugin.id" @click="pluginAction('activate', plugin)" x-text="pluginBusy === plugin.id ? 'Изпълнение…' : 'Активирай'"></button><button class="button secondary" type="button" x-show="plugin.status === 'active'" :disabled="pluginBusy === plugin.id" @click="pluginAction('deactivate', plugin)" x-text="pluginBusy === plugin.id ? 'Изпълнение…' : 'Деактивирай'"></button><button class="button danger" type="button" x-show="plugin.status === 'inactive' || plugin.status === 'installed' || plugin.status === 'error'" :disabled="pluginBusy === plugin.id" @click="pluginAction('uninstall', plugin)">Премахни</button></td></tr></template><tr x-show="plugins.length === 0"><td colspan="5" class="empty-state">Няма открити плъгини.</td></tr></tbody></table></div></section></template>
          <template x-if="page === 'plugin-detail'"><section><div class="page-heading-row"><div><h1 x-text="pluginDetail?.name"></h1><p class="lead" x-text="pluginDetail?.description || 'Подробности и lifecycle управление на разширението.'"></p></div><div class="page-heading-actions"><button class="button secondary" type="button" @click="navigate('/admin/plugins')">Назад към разширенията</button><button class="button secondary" type="button" x-show="pluginDetail?.status === 'installed' || pluginDetail?.status === 'inactive'" @click="pluginAction('activate', pluginDetail)">Активирай</button><button class="button secondary" type="button" x-show="pluginDetail?.status === 'active'" @click="pluginAction('deactivate', pluginDetail)">Деактивирай</button><button class="button secondary" type="button" x-show="pluginDetail?.last_update_id" :disabled="pluginBusy === pluginDetail?.id" @click="rollbackRemotePlugin(pluginDetail)">Върни предходната версия</button></div></div>${breadcrumbsMarkup("pluginDetail?.name ?? 'Разширение'", [{ label: "Разширения", href: "/admin/plugins" }])}<div class="plugin-detail-grid"><section class="content-card"><header>${sectionHeader("Основна информация", "plugin-detail-info")}</header><div class="section-body plugin-detail-list" x-show="!isSectionCollapsed('plugin-detail-info')"><div><span>ID</span><strong x-text="pluginDetail?.id"></strong></div><div><span>Версия</span><strong x-text="pluginDetail?.version"></strong></div><div><span>Entrypoint</span><strong x-text="pluginDetail?.entrypoint"></strong></div><div><span>Път</span><strong x-text="pluginDetail?.path"></strong></div><div><span>Статус</span>${statusBadgeMarkup("pluginDetail?.status")}</div></div></section><section class="content-card"><header>${sectionHeader("Разрешения", "plugin-detail-permissions")}</header><div class="section-body plugin-permissions" x-show="!isSectionCollapsed('plugin-detail-permissions')"><p class="field-hint">Одобрете само разрешенията, от които плъгинът действително се нуждае. Активирането е блокирано, докато всички заявени разрешения не бъдат одобрени.</p><template x-for="permission in (pluginDetail?.requested_permissions || [])" :key="permission"><label class="checkbox-row"><input type="checkbox" :value="permission" x-model="pluginPermissionDraft"><span x-text="permission"></span></label></template><p class="table-cell-secondary" x-show="(pluginDetail?.requested_permissions || []).length === 0">Плъгинът не заявява специални разрешения.</p><button class="button primary" type="button" :disabled="pluginDetail?.status === 'active'" @click="approvePluginPermissions()">Запази разрешенията</button></div></section><section class="content-card"><header>${sectionHeader("Manifest", "plugin-detail-manifest")}</header><div class="section-body" x-show="!isSectionCollapsed('plugin-detail-manifest')">${codeEditorMarkup("pluginDetail?.manifest || {}")}</div></section></div><div class="notice error" x-show="pluginDetail?.last_error" x-text="pluginDetail?.last_error"></div></section></template>
          <template x-if="page === 'pages'"><section>${breadcrumbsMarkup("'Страници'")}<div class="page-heading-row pages-heading"><div><h1 x-text="trashMode ? 'Кошче' : 'Страници'"></h1>${collapsibleTextMarkup("Тук управлявате съдържанието на сайта — създавате нови страници, редактирате съществуващи и организирате страниците в родителска йерархия. Използвайте „Нова страница“, за да добавите страница. В таблицата можете да сортирате по име, slug, статус или дата на обновяване, а чрез менюто „Действия“ да редактирате съдържанието, статуса и родителската страница.")}</div><div class="page-heading-actions"><button class="button secondary bulk-action-trigger" type="button" @click="openBulkModal" :disabled="selectedPageIds.length === 0">Масови действия<span x-show="selectedPageIds.length > 0" x-text="\` (\${selectedPageIds.length})\`"></span></button><button class="button secondary" type="button" @click="openFilterModal">Филтри</button><button class="button secondary" type="button" @click="toggleTrashMode" x-text="trashMode ? 'Всички страници' : 'Кошче'"></button><button class="button primary" type="button" @click="startCreate" x-show="!trashMode">Нова страница</button></div></div><div class="notice error" x-show="error" x-text="error"></div><div class="pages-table">${dataTableMarkup("filteredPageRows()", [{ key: "title", label: "Име", sortable: true, linkTemplate: "/admin/pages/{id}/edit" }, { key: "slug", label: "Slug", sortable: true }, { key: "status", label: "Статус", sortable: true }, { key: "updated_at", label: "Дата на обновяване", sortable: true }], actionDropdownMarkup('<button class="dropdown-option" type="button" x-show="!trashMode" @click="startEdit(row)">Редактирай</button><button class="dropdown-option" type="button" x-show="!trashMode" @click="startSettings(row)">Настройки</button><button class="dropdown-option" type="button" x-show="!trashMode" @click="openPageModal(\'trash\', row)">Премести в кошчето</button><button class="dropdown-option" type="button" x-show="trashMode" @click="openPageModal(\'restore\', row)">Възстанови</button><button class="dropdown-option" type="button" x-show="trashMode" @click="openPageModal(\'force\', row)">Изтрий завинаги</button>'), true)}</div></section></template>
          <template x-if="page === 'pages-create' || page === 'pages-edit'"><section><div class="page-heading-row"><div>${breadcrumbsMarkup("page === 'pages-edit' ? 'Редактиране на страница' : 'Създаване на страница'", [{ label: "Страници", href: "/admin/pages" }])}<h1 x-text="page === 'pages-edit' ? 'Редактиране на страница' : 'Създаване на страница'"></h1>${collapsibleTextMarkup("В този формуляр създавате или редактирате страница от сайта. Въведете заглавие — системата ще генерира автоматично slug адреса, докато не го промените ръчно. Изберете родителска страница, ако страницата трябва да бъде част от йерархия. Добавете съдържание чрез текстовия редактор, изберете статус и запазете промените. Невалидните полета ще бъдат маркирани с конкретно съобщение.")}</div><div class="page-heading-actions"><button class="button primary" type="button" @click="startSettings" x-show="page === 'pages-edit'">Настройки</button><button class="button primary" type="button" @click="startCreate" x-show="page === 'pages-edit'">Нова страница</button></div></div><div class="notice error" x-show="error" x-text="error"></div><form class="page-form" @submit.prevent="savePage"><p class="form-required-note"><span class="required-marker" aria-hidden="true">*</span> Задължителни полета</p><label>Заглавие<input data-slot="input" type="text" x-model="form.title" maxlength="190" @input="if (!slugManuallyEdited) form.slug = slugify(form.title)" required aria-required="true" :aria-invalid="fieldErrors.title ? true : undefined"><span class="field-error" x-show="fieldErrors.title" x-text="fieldErrors.title"></span></label><label>URL адрес (slug)<input data-slot="input" type="text" x-model="form.slug" maxlength="190" @input="slugManuallyEdited = true" required aria-required="true" :aria-invalid="fieldErrors.slug ? true : undefined"><span class="field-error" x-show="fieldErrors.slug" x-text="fieldErrors.slug"></span></label>${richTextEditorMarkup("form.content", "Съдържание")}${contentBlocksMarkup()}${parentDropdownMarkup()}<label><span class="field-label">Статус<span class="required-marker" aria-hidden="true">*</span></span><select data-slot="select-trigger" x-model="form.status" required aria-required="true"><option value="draft">Чернова</option><option value="published">Публикувана</option></select><span class="field-error" x-show="fieldErrors.status" x-text="fieldErrors.status"></span></label><div class="page-form-actions"><button class="button primary" type="submit" :disabled="saving" x-text="saving ? 'Записване…' : 'Запази страницата'"></button><button class="button secondary" type="button" @click="navigate('/admin/pages')">Отказ</button></div></form></section></template>
          <template x-if="page === 'pages-settings'"><section><div class="page-heading-row"><div>${breadcrumbsMarkup("'Настройки на страница'", [{ label: "Страници", href: "/admin/pages" }])}<h1>Настройки на страница</h1><p class="page-settings-subject">Настройки за: <strong x-text="form.title || 'страницата'"></strong></p>${collapsibleTextMarkup("Тук управлявате основните и навигационните настройки на страницата. Шаблонът определя начина на визуализация, позицията контролира реда в навигацията, а sitemap настройката управлява участието на страницата в картата на сайта.")}</div></div><div class="notice error" x-show="error" x-text="error"></div><form class="page-form" @submit.prevent="savePageSettings"><div class="settings-grid"><label><span class="field-label">Шаблон на страницата</span><select data-slot="select-trigger" x-model="pageSettings.template"><option value="default">Стандартен</option><option value="full_width">Пълна ширина</option><option value="landing">Landing page</option></select></label><label><span class="field-label">Позиция в навигацията</span><input class="form-control" type="number" min="0" step="1" x-model.number="pageSettings.menu_order"><span class="field-hint-text">По-малките числа се показват по-напред.</span></label></div><label class="checkbox-field"><input type="checkbox" x-model="pageSettings.use_parent_slugs"><span>Използвай slug-овете на родителските страници в URL адреса</span></label><label class="checkbox-field"><input type="checkbox" x-model="pageSettings.show_in_navigation"><span>Показвай страницата в навигацията</span></label><label class="checkbox-field"><input type="checkbox" x-model="pageSettings.show_in_sitemap"><span>Включи страницата в sitemap-а</span></label><div class="page-form-actions"><button class="button primary" type="submit" :disabled="saving" x-text="saving ? 'Записване…' : 'Запази настройките'"></button><button class="button secondary" type="button" @click="navigate('/admin/pages/' + editingId + '/edit')">Назад към редакцията</button></div></form></section></template>
          <template x-if="page === 'updates'"><section>${breadcrumbsMarkup("'Обновявания'")}<h1>Обновявания</h1><div class="notice success" x-show="notice" x-text="notice"></div><div class="notice error" x-show="error" x-text="error"></div><section class="content-card"><header>${sectionHeader("Качване на platform пакет", "updates-upload")}</header><div class="section-body" x-show="!isSectionCollapsed('updates-upload')"><form method="post" action="/admin/updates/install" enctype="multipart/form-data"><input type="hidden" name="_token" :value="csrfToken"><input type="hidden" name="mode" value="install"><label>ZIP пакет на новата версия<input type="file" name="package" accept="application/zip,.zip" required></label><button class="button primary" type="submit">Актуализирай платформата</button></form><p class="muted">Системата проверява checksum, цифровия подпис и съвместимостта, създава backup, изпълнява миграциите и прави health check.</p></div></section><section class="content-card"><header>${sectionHeader("История", "updates-history")}</header><div class="section-body" x-show="!isSectionCollapsed('updates-history')"><div class="table-wrapper"><table><thead><tr><th>Тип</th><th>ID</th><th>От</th><th>До</th><th>Дата</th><th>Действия</th></tr></thead><tbody><template x-for="item in history" :key="item.id"><tr><td x-text="item.type"></td><td x-text="item.id"></td><td x-text="item.from"></td><td x-text="item.to"></td><td x-text="item.installed_at || item.rolled_back_at"></td><td><form method="post" action="/admin/updates/rollback"><input type="hidden" name="_token" :value="csrfToken"><input type="hidden" name="id" :value="item.id"><button class="button secondary" type="submit">Rollback</button></form></td></tr></template></tbody></table></div></div></section></section></template>
        </main>
      </div>
      ${confirmModalMarkup()}${filterModalMarkup(dropdownMarkup("draftPageFilters.status", [{ value: "all", label: "Всички статуси" }, { value: "draft", label: "Чернови" }, { value: "published", label: "Публикувани" }]), dropdownMarkup("draftPageFilters.structure", [{ value: "all", label: "Всички страници" }, { value: "root", label: "Родителски страници" }, { value: "child", label: "Дъщерни страници" }]), dropdownMarkup("draftPageFilters.view", [{ value: "active", label: "Активни страници" }, { value: "trash", label: "Кошче" }]))}${bulkActionModalMarkup(dropdownMarkup("bulkModal.action", [{ value: "trash", label: "Премести в кошчето" }, { value: "force", label: "Изтрий завинаги" }, { value: "settings", label: "Редактиране на настройки" }]))}${userFilterModalMarkup()}${userBulkActionModalMarkup()}${userDeleteModalMarkup()}<div class="admin-system-footer"><span>Flex CMS</span><strong>v${escapeHtml(readBootstrap()?.version ?? "")}</strong></div>
    </div>`

  const withAdminExtensions = markup
    .replace(/<template x-if="page === 'plugins'">[\s\S]*?<\/section><\/template>/, pluginsPageMarkup())
    .replace(`<template x-if="page === 'plugin-detail'">`, `${themeCatalogPageMarkup()}${pluginCatalogPageMarkup()}${catalogPluginDetailMarkup()}<template x-if="page === 'plugin-detail'">`)
    .replace('<h1>Обновявания</h1>', `<h1>Обновявания</h1>${remoteUpdatesMarkup()}`)
    .replace("</ul></nav>", `${adminSidebarMarkup()}</ul></nav>`)
    .replace(`<template x-if="page === 'plugins'">`, `${userFormPageMarkup()}${usersPageMarkup()}<template x-if="page === 'plugins'">`)
    .replace('href="/api/users">Отвори API →', 'href="/admin/users" @click.prevent="navigate(\'/admin/users\')">Покажи потребителите →')
    .replace('<h1>Административен панел', `${adminSlotMarkup("admin.dashboard.before")}<h1>Административен панел`)
    .replace('<p class="lead">Имате пълен достъп до системната администрация като супер администратор.</p>', `<p class="lead">Имате пълен достъп до системната администрация като супер администратор.</p>${dashboardQuickStatsMarkup()}${adminSlotMarkup("admin.dashboard.after")}`)
    .replace('<h1>Профил</h1>', `${adminSlotMarkup("admin.profile.before")}<h1>Профил</h1>`)
    .replace('<p class="lead">Основни данни за текущия потребител.</p>', `<p class="lead">Основни данни за текущия потребител.</p>${adminSlotMarkup("admin.profile.after")}`)
    .replace('<div class="pages-table">', `${adminSlotMarkup("admin.pages.table.before")}<div class="pages-table">`)
    .replace('<form class="page-form"', `${adminSlotMarkup("admin.page.form.before")}<form class="page-form"`)
    .replace('<div class="page-form-actions">', `${adminSlotMarkup("admin.page.form.after")}<div class="page-form-actions">`)
    .replace('<section class="content-card"><header>${sectionHeader("Качване на platform пакет", "updates-upload")}', `${adminSlotMarkup("admin.updates.before")}<section class="content-card"><header>${sectionHeader("Качване на platform пакет", "updates-upload")}`)
    .replace('<section class="content-card"><header>${sectionHeader("История", "updates-history")}', `<section class="content-card"><header>${sectionHeader("История", "updates-history")}${adminSlotMarkup("admin.updates.after")}`)

  const withDropdowns = withAdminExtensions
    .replace(/<select x-model="theme" @change="saveTheme">.*?<\/select>/, dropdownMarkup("theme", [{ value: "system", label: "Системна" }, { value: "light", label: "Светла" }, { value: "dark", label: "Тъмна" }], "saveTheme()"))
    .replace(/<select data-slot="select-trigger" x-model="form.status"[^>]*>.*?<\/select>/, dropdownMarkup("form.status", [{ value: "draft", label: "Чернова" }, { value: "published", label: "Публикувана" }]))
    .replace(/<select data-slot="select-trigger" x-model="pageSettings.template"[^>]*>.*?<\/select>/, dropdownMarkup("pageSettings.template", [{ value: "default", label: "Стандартен" }, { value: "full_width", label: "Пълна ширина" }, { value: "landing", label: "Landing page" }], undefined, '<span class="field-hint-text">Определя основната структура и визуализация на страницата.</span>'))

  const withUserDropdowns = withDropdowns
    .replace(/<select data-slot="select-trigger" x-model="userForm.role">.*?<\/select>/, dropdownMarkup("userForm.role", [{ value: "user", label: "Потребител" }, { value: "editor", label: "Редактор" }, { value: "admin", label: "Администратор" }, { value: "super_admin", label: "Супер администратор" }]))
    .replace(/<select data-slot="select-trigger" x-model="userForm.status">.*?<\/select>/, dropdownMarkup("userForm.status", [{ value: "active", label: "Активен" }, { value: "disabled", label: "Деактивиран" }]))

  const withControls = stripUsersTable(withUserDropdowns)
    .replaceAll('<input data-slot="input"', '<input class="form-control" data-slot="input"')
    .replaceAll('<textarea ', '<textarea class="form-control" ')
    .replaceAll('<input type="file"', '<input class="form-control" type="file"')

  const withHints = withControls
    .replace(/<label>Заглавие(<input[^>]*>)/, `<label><span class="field-label">Заглавие<span class="required-marker" aria-hidden="true">*</span>${fieldHintMarkup("Въведете ясно и кратко име на страницата. Използва се и за автоматичното генериране на slug.")}</span>$1`)
    .replace(/<label>URL адрес \(slug\)(<input[^>]*>)/, `<label><span class="field-label">URL адрес (slug)<span class="required-marker" aria-hidden="true">*</span>${fieldHintMarkup("Slug адресът се генерира автоматично от заглавието и се използва в URL адреса на страницата.")}</span>$1`)
    .replace(/<div class="rich-text-field"><label class="rich-text-label">Съдържание<\/label>/, `<div class="rich-text-field"><label class="rich-text-label"><span class="field-label">Съдържание${fieldHintMarkup("Използвайте toolbar-а за форматиране на текста, списъци, заглавия, линкове и блокови елементи.")}</span></label>`)
    .replace(/<label>ZIP пакет на новата версия(<input[^>]*>)/, `<label><span class="field-label">ZIP пакет на новата версия${fieldHintMarkup("Изберете валиден ZIP пакет с release на платформата. Системата ще провери подписа, checksum-а и съвместимостта.")}</span>$1`)
    .replace('<select data-slot="select-trigger" x-model="pageSettings.template"><option value="default">Стандартен</option><option value="full_width">Пълна ширина</option><option value="landing">Landing page</option></select>', '<select data-slot="select-trigger" x-model="pageSettings.template"><option value="default">Стандартен</option><option value="full_width">Пълна ширина</option><option value="landing">Landing page</option></select><span class="field-hint-text">Определя основната структура и визуализация на страницата.</span>')
    .replace('<span class="field-error" x-show="fieldErrors.status" x-text="fieldErrors.status"></span></label>', '<span class="field-error" x-show="fieldErrors.status" x-text="fieldErrors.status"></span></label></div>')

  const withSettingsFields = withHints.replace(
    /(<label class="checkbox-field"><input type="checkbox" x-model="pageSettings\.show_in_sitemap"><span>Включи страницата в sitemap-а<\/span><\/label>)(<div class="page-form-actions">)/,
    `$1${pluginSettingsMarkup()}$2`,
  )
  const withPermissionButton = withSettingsFields.replace(
    /<button class="button primary" type="button" :disabled="pluginDetail\?\.status === 'active'" @click="approvePluginPermissions\(\)">Запази разрешенията<\/button>/,
    `<button class="button primary" type="button" x-show="pluginDetail?.status !== 'active'" :disabled="pluginPermissionBusy" @click="approvePluginPermissions()" x-text="pluginPermissionBusy ? 'Запазване…' : 'Запази разрешенията'"></button>`,
  )

  const withoutManifestSection = withPermissionButton.replace(
    /<section class="content-card"><header><button class="section-header" data-section-key="plugin-detail-manifest"[\s\S]*?<\/section>/,
    codeEditorMarkup("pluginDetail?.manifest || {}"),
  )

  const withUpdateUploadStyles = withoutManifestSection
    .replace(
      '<section class="content-card"><header>${sectionHeader("Качване на platform пакет", "updates-upload")}',
      '<section class="content-card updates-upload-card"><header>${sectionHeader("Качване на platform пакет", "updates-upload")}',
    )
    .replace(
      '<form method="post" action="/admin/updates/install" enctype="multipart/form-data">',
      '<form class="updates-upload-form" method="post" action="/admin/updates/install" enctype="multipart/form-data">',
    )
    .replace(
      '<label><span class="field-label">ZIP пакет на новата версия',
      '<label class="updates-upload-field"><span class="field-label">ZIP пакет на новата версия',
    )
    .replace(
      '<button class="button primary" type="submit">Актуализирай платформата</button>',
      '<button class="button primary updates-upload-submit" type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0-12-4 4m4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg><span>Актуализирай платформата</span></button>',
    )
    .replace(
      '<p class="muted">Системата проверява checksum, цифровия подпис и съвместимостта, създава backup, изпълнява миграциите и прави health check.</p>',
      '<div class="updates-upload-help"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 10v6m0-9h.01" /></svg><p>Преди инсталацията системата проверява checksum-а, цифровия подпис и съвместимостта, създава backup, изпълнява миграциите и прави health check.</p></div>',
    )

  return withUpdateUploadStyles.replace(/ x-show="!isSectionCollapsed\('([^']+)'\)"/g, ` x-show="!isSectionCollapsed('$1')" x-transition:enter="section-transition" x-transition:enter-start="section-transition-start" x-transition:enter-end="section-transition-end" x-transition:leave="section-transition" x-transition:leave-start="section-transition-end" x-transition:leave-end="section-transition-start"`)
}

function dashboardQuickStatsMarkup(): string {
  return `<section class="dashboard-grid dashboard-grid-secondary" aria-label="Обобщение на системата"><article class="content-card"><header>${sectionHeader("Страници", "dashboard-pages")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-pages')"><strong class="dashboard-stat-value" x-text="pages.length"></strong><p>Създадени страници в системата.</p><a href="/admin/pages" @click.prevent="navigate('/admin/pages')">Управление на страниците →</a></div></article><article class="content-card"><header>${sectionHeader("Разширения", "dashboard-plugins")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-plugins')"><strong class="dashboard-stat-value" x-text="plugins.filter((plugin) => plugin.status === 'active').length"></strong><p>Активни разширения.</p><a href="/admin/plugins" @click.prevent="navigate('/admin/plugins')">Управление на разширенията →</a></div></article><article class="content-card"><header>${sectionHeader("Бързи действия", "dashboard-actions")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-actions')"><div class="dashboard-actions"><a class="button secondary" href="/admin/pages/create" @click.prevent="startCreate">Нова страница</a><a class="button secondary" href="/admin/updates" @click.prevent="navigate('/admin/updates')">Провери обновявания</a><a class="button secondary" href="/admin/profile" @click.prevent="navigate('/admin/profile')">Профил</a></div></div></article></section>`
}

function userBasicFormMarkup(): string {
  return `<form class="page-form" @submit.prevent="saveUser"><div class="user-form-grid"><label><span class="field-label">Име<span class="required-marker" aria-hidden="true">*</span>${fieldHintMarkup("Въведете името, което ще се показва в административния панел.")}</span><input data-slot="input" type="text" x-model="userForm.name" maxlength="120" required aria-required="true"></label><label><span class="field-label">Имейл<span class="required-marker" aria-hidden="true">*</span>${fieldHintMarkup("Използва се за вход и за системни известия към потребителя.")}</span><input data-slot="input" type="email" x-model="userForm.email" maxlength="190" required aria-required="true"></label><label x-show="page === 'users-create'"><span class="field-label">Парола<span class="required-marker" aria-hidden="true">*</span>${fieldHintMarkup("Минимум 12 символа. Паролата се използва за първоначалния вход.")}</span><input data-slot="input" type="password" x-model="userForm.password" minlength="12" autocomplete="new-password" :required="page === 'users-create'" aria-required="true"></label><label><span class="field-label">Роля${fieldHintMarkup("Определя какви административни действия може да извършва потребителят.")}</span><select data-slot="select-trigger" x-model="userForm.role"><option value="user">Потребител</option><option value="editor">Редактор</option><option value="admin">Администратор</option><option value="super_admin">Супер администратор</option></select></label><label><span class="field-label">Статус${fieldHintMarkup("Деактивираните потребители не могат да влизат в административния панел.")}</span><select data-slot="select-trigger" x-model="userForm.status"><option value="active">Активен</option><option value="disabled">Деактивиран</option></select></label></div><label class="checkbox-field" x-show="page === 'users-create'"><input type="checkbox" x-model="userForm.send_confirmation"><span>Изпрати код за потвърждение на имейла</span></label><p class="field-hint-text" x-show="page === 'users-create'">Потребителят ще получи шестцифрен код на посочения имейл и няма да може да влезе, докато не го потвърди.</p><div class="page-form-actions"><button class="button primary" type="submit" :disabled="userSaving" x-text="userSaving ? 'Записване…' : (userEditingId ? 'Запази промените' : 'Създай потребител')"></button><button class="button secondary" type="button" @click="navigate('/admin/users')">Отказ</button></div></form>`
}

function usersPageMarkup(): string {
  const userTable = dataTableMarkup(
    "filteredUserRows()",
    [
      { key: "name", label: "Име", sortable: true, linkTemplate: "/admin/users/{id}/edit" },
      { key: "email", label: "Имейл", sortable: true },
      { key: "role", label: "Роля", sortable: true },
      { key: "status", label: "Статус", sortable: true },
    ],
    actionDropdownMarkup('<button class="dropdown-option" type="button" @click="startUserEdit(row)">Редактирай</button><button class="dropdown-option" type="button" :disabled="userBusy === row.id" @click="toggleUserStatus(row)" x-text="userBusy === row.id ? \'Записване…\' : (row.status === \'active\' ? \'Деактивирай\' : \'Активирай\')"></button><button class="dropdown-option dropdown-option-danger" type="button" x-show="row.role !== \'admin\' && row.role !== \'super_admin\'" @click="openUserDeleteModal(row)">Изтрий</button>'),
    true,
    { selectedIds: "selectedUserIds", allVisibleRowsSelected: "allVisibleUserRowsSelected", toggleAllVisibleRows: "toggleAllVisibleUserRows", toggleRowSelection: "toggleUserRowSelection" },
  )

  return `<template x-if="page === 'users'"><section>${breadcrumbsMarkup("'Потребители'")}<div class="page-heading-row pages-heading"><div><h1>Потребители</h1>${collapsibleTextMarkup("Тук управлявате потребителите в системата. Можете да създавате нови потребители, да редактирате основните им данни и да променяте ролята и статуса им.")}</div><div class="page-heading-actions"><button class="button secondary bulk-action-trigger" type="button" @click="openUserBulkModal" :disabled="selectedUserIds.length === 0">Масови действия<span class="action-count" x-show="selectedUserIds.length > 0" x-text="selectedUserIds.length"></span></button><button class="button secondary" type="button" @click="openUserFilterModal">Филтри<span class="filter-count" x-show="userFilterCount() > 0" x-text="userFilterCount()"></span></button><button class="button primary" type="button" @click="navigate('/admin/users/create')">Нов потребител</button></div></div><div class="notice error" x-show="error" x-text="error"></div><div class="pages-table">${userTable}</div></section></template>`
}

function userDeleteModalMarkup(): string {
  return `<div class="modal-backdrop" x-show="userDeleteModal.open" x-cloak @click.self="closeUserDeleteModal" @keydown.escape.window="closeUserDeleteModal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="user-delete-modal-title"><header class="modal-header"><h2 id="user-delete-modal-title">Изтриване на потребител</h2><button class="modal-close" type="button" aria-label="Затвори" @click="closeUserDeleteModal">×</button></header><div class="modal-content"><p>Сигурни ли сте, че искате да изтриете потребителя „<strong x-text="userDeleteModal.user?.name"></strong>“?</p><p class="muted">Това действие не може да бъде отменено.</p></div><footer class="modal-footer"><button class="button secondary" type="button" @click="closeUserDeleteModal">Отказ</button><button class="button danger" type="button" :disabled="userDeleteModal.busy" @click="confirmUserDelete" x-text="userDeleteModal.busy ? 'Изтриване…' : 'Изтрий'"></button></footer></section></div>`
}

function userFilterModalMarkup(): string {
  return `<div class="modal-backdrop" x-show="userFilterModalOpen" x-cloak @click.self="closeUserFilterModal" @keydown.escape.window="closeUserFilterModal"><section class="modal filter-modal" role="dialog" aria-modal="true" aria-labelledby="user-filter-modal-title"><header class="modal-header"><h2 id="user-filter-modal-title">Филтри на потребителите</h2><button class="modal-close" type="button" aria-label="Затвори" @click="closeUserFilterModal">×</button></header><div class="modal-content modal-filter-content"><label><span class="field-label">Роля</span>${dropdownMarkup("draftUserFilters.role", [{ value: "all", label: "Всички роли" }, { value: "user", label: "Потребители" }, { value: "editor", label: "Редактори" }, { value: "admin", label: "Администратори" }, { value: "super_admin", label: "Супер администратори" }])}</label><label><span class="field-label">Статус</span>${dropdownMarkup("draftUserFilters.status", [{ value: "all", label: "Всички статуси" }, { value: "active", label: "Активни" }, { value: "disabled", label: "Деактивирани" }])}</label></div><footer class="modal-footer"><button class="button secondary" type="button" @click="resetUserFilters">Изчисти</button><button class="button secondary" type="button" @click="closeUserFilterModal">Отказ</button><button class="button primary" type="button" @click="applyUserFilters">Приложи филтрите</button></footer></section></div>`
}

function userBulkActionModalMarkup(): string {
  return `<div class="modal-backdrop" x-show="userBulkModal.open" x-cloak @click.self="closeUserBulkModal" @keydown.escape.window="closeUserBulkModal"><section class="modal bulk-action-modal" role="dialog" aria-modal="true" aria-labelledby="user-bulk-action-modal-title"><header class="modal-header"><h2 id="user-bulk-action-modal-title">Масови действия</h2><button class="modal-close" type="button" aria-label="Затвори" @click="closeUserBulkModal">×</button></header><div class="modal-content modal-filter-content"><p>Изберете операция за маркираните потребители.</p><p class="muted" x-text="\`Избрани записи: \${selectedUserIds.length}\`"></p><label><span class="field-label">Действие</span>${dropdownMarkup("userBulkModal.action", [{ value: "activate", label: "Активирай" }, { value: "disable", label: "Деактивирай" }, { value: "delete", label: "Изтрий" }])}</label></div><footer class="modal-footer"><button class="button secondary" type="button" @click="closeUserBulkModal">Отказ</button><button class="button primary" type="button" :disabled="userBulkModal.busy || selectedUserIds.length === 0" @click="applyUserBulkAction" x-text="userBulkModal.busy ? 'Изпълнение…' : 'Приложи'"></button></footer></section></div>`
}

function userPasswordMarkup(): string {
  return `<div class="user-password-form" x-show="page === 'users-edit'"><div class="form-subsection-heading"><h2>Смяна на паролата</h2></div><form class="page-form" @submit.prevent="saveUserPassword"><label x-show="user.role !== 'super_admin'"><span class="field-label">Текуща парола${fieldHintMarkup("Изисква се за потвърждение при несупер администратор.")}</span><input data-slot="input" type="password" x-model="userPasswordCurrent" autocomplete="current-password" :required="user.role !== 'super_admin'" aria-required="false"></label><label><span class="field-label">Нова парола<span class="required-marker" aria-hidden="true">*</span>${fieldHintMarkup("Минимум 12 символа.")}</span><input data-slot="input" type="password" x-model="userPassword" minlength="12" required aria-required="true"></label><label><span class="field-label">Потвърди новата парола<span class="required-marker" aria-hidden="true">*</span>${fieldHintMarkup("Въведете същата парола още веднъж.")}</span><input data-slot="input" type="password" x-model="userPasswordConfirmation" minlength="12" required aria-required="true"></label><div class="page-form-actions"><button class="button primary" type="submit" :disabled="userPasswordSaving" x-text="userPasswordSaving ? 'Записване…' : 'Смени паролата'"></button></div></form></div>`
}

function userFormPageMarkup(): string {
  return `<template x-if="page === 'users-create' || page === 'users-edit'"><section><div class="page-heading-row pages-heading user-form-heading"><div>${breadcrumbsMarkup("page === 'users-edit' ? 'Редактиране на потребител' : 'Създаване на потребител'", [{ label: "Потребители", href: "/admin/users" }])}<h1 x-text="page === 'users-edit' ? 'Редактиране на потребител' : 'Създаване на потребител'"></h1>${collapsibleTextMarkup("Тук създавате или редактирате потребител. Въведете основните данни, изберете роля и статус, след което запазете промените. При редактиране можете отделно да зададете нова парола.")}</div><div class="page-heading-actions"><button class="button primary" type="button" @click="navigate('/admin/users/create')" x-show="page === 'users-edit'">Нов потребител</button></div></div><div class="notice error" x-show="error" x-text="error"></div>${userBasicFormMarkup()}${userPasswordMarkup()}</section></template>`
}

function stripUsersTable(markup: string): string {
  return markup.replace(/<section class="content-card"><header>[\s\S]*?users-list[\s\S]*?<\/header><div class="section-body"[\s\S]*?><div class="table-wrapper">([\s\S]*?)<\/div><\/div><\/section>/, '<div class="table-wrapper users-table">$1</div>')
}

function alignBreadcrumbsBelowDescription(): void {
  root?.querySelectorAll<HTMLElement>(".breadcrumbs").forEach((breadcrumbs) => {
    const section = breadcrumbs.closest("section")
    const description = section?.querySelector<HTMLElement>(".collapsible-text")
    const lead = section?.querySelector<HTMLElement>(":scope > .lead")
    const heading = section?.querySelector<HTMLElement>(":scope > h1")
    const anchor = description ?? lead ?? heading

    if (anchor && anchor.nextElementSibling !== breadcrumbs) {
      anchor.after(breadcrumbs)
    }
  })
}

function groupPageSettingsCheckboxes(): void {
  const form = root?.querySelector<HTMLInputElement>('input[x-model="pageSettings.use_parent_slugs"]')?.closest("form")
  if (!form) return
  const parentSlugCheckbox = form.querySelector<HTMLElement>('label.checkbox-field:has(input[x-model="pageSettings.use_parent_slugs"])')
  const checkboxes = form.querySelectorAll<HTMLElement>(":scope > label.checkbox-field")
  const lastCheckbox = checkboxes[checkboxes.length - 1]
  if (parentSlugCheckbox && lastCheckbox && parentSlugCheckbox !== lastCheckbox) lastCheckbox.after(parentSlugCheckbox)
}

function createAdminState(initial: Bootstrap) {
  const pageFilters = readPageFiltersFromUrl()
  const userFilters = readUserFiltersFromUrl()
  const state = {
    catalogDetail: initial.catalogDetail ?? null,
    remoteUpdate: initial.remoteUpdate ?? { current_version: initial.version, channel: "stable", error: null, available: null }, updateJobs: initial.updateJobs ?? [],
    page: initial.page, pageTitle: "", csrfToken: initial.csrfToken, version: initial.version,
    width: initial.sidebarWidth, collapsed: initial.sidebarCollapsed ?? false, mobileOpen: false, isMobile: false, loading: false,
    user: initial.user ?? { name: "", email: "", role: "", status: "" }, users: initial.users ?? 0, userList: initial.userList ?? [], userData: initial.userData ?? null, userEditingId: initial.userData?.id ?? null, userForm: { name: initial.userData?.name ?? "", email: initial.userData?.email ?? "", password: "", role: initial.userData?.role ?? "user", status: initial.userData?.status ?? "active" }, userPasswordCurrent: "", userPassword: "", userPasswordConfirmation: "", userSaving: false, userPasswordSaving: false, userBusy: null as number | null, userFilters, draftUserFilters: { ...userFilters }, userFilterModalOpen: false, selectedUserIds: [] as number[], userBulkModal: { open: false, action: "activate" as "activate" | "disable" | "delete", busy: false }, theme: localStorage.getItem("flexcms.admin.theme") ?? "system",
    pages: initial.pages ?? [], trashedPages: initial.trashedPages ?? [], plugins: initial.plugins ?? [], pluginCatalog: initial.pluginCatalog ?? [], pluginDetail: initial.pluginDetail ?? null, pluginPermissionDraft: initial.pluginDetail?.approved_permissions ?? [] as string[], adminExtensions: initial.adminExtensions ?? { sidebar: [], slots: {} }, pageFields: initial.pageFields ?? [], pageSettingsFields: initial.pageSettingsFields ?? [], pluginFields: pageFieldDefaults(initial.pageFields ?? []), pluginSettings: pageFieldDefaults(initial.pageSettingsFields ?? []), pluginBusy: "", pluginUploadBusy: false, pluginPermissionBusy: false, trashMode: pageFilters.view === "trash", pageFilters, draftPageFilters: { ...pageFilters }, filterModalOpen: false, history: initial.history ?? [], notice: initial.notice ?? "", error: initial.error ?? "", inspection: initial.inspection, collapsedSections: initial.collapsedSections ?? {},
    pageModal: { open: false, action: "trash" as "trash" | "restore" | "force", title: "", message: "", confirmLabel: "", page: null as PageRecord | null, busy: false }, userDeleteModal: { open: false, user: null as { id: number; name: string; email: string } | null, busy: false },
    selectedPageIds: [] as number[], bulkModal: { open: false, action: "trash" as "trash" | "force" | "settings", busy: false, settings: { use_parent_slugs: false, no_index: false, show_in_navigation: true, show_in_sitemap: true } },
    editingId: null as number | null, saving: false, slugManuallyEdited: false, fieldErrors: {} as FieldErrors,
    form: { title: "", slug: "", content: "", blocks: [] as ContentBlock[], parentId: "" as string | number, status: "draft" as "draft" | "published" }, pageSettings: { seo_title: "", meta_description: "", canonical_url: "", template: "default", menu_order: 0, use_parent_slugs: false, no_index: false, show_in_navigation: true, show_in_sitemap: true } as PageSettings,
    init() { this.syncMedia(); window.addEventListener("resize", () => this.syncMedia()); this.saveTheme(); setTimeout(() => this.syncCollapsedSections(), 0) },
    selectedCatalogPlugin() { const prefix = "/admin/plugins/catalog/"; const path = window.location.pathname; const id = path.startsWith(prefix) ? decodeURIComponent(path.slice(prefix.length)) : ""; return this.catalogDetail ?? this.pluginCatalog.find((item: { id: string }) => item.id === id) ?? null },
    activateTheme(theme: ThemeRecord) { const self = this as typeof this & { themes: ThemeRecord[]; themeBusy: string }; if (self.themeBusy || theme.active || !theme.valid) return; self.themeBusy = theme.id; $.ajax({ url: "/api/themes/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ action: "activate", id: theme.id }) }).done((response: { themes?: ThemeRecord[] }) => { self.themes = response.themes ?? self.themes; showToast("Темата е активирана.", "success") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Темата не можа да бъде активирана."; this.error = message; showToast(message, "error") }).always(() => { self.themeBusy = "" }) },
    updateTheme(theme: ThemeRecord) { const self = this as typeof this & { themes: ThemeRecord[]; themeBusy: string }; if (self.themeBusy || !theme.update_available) return; if (!window.confirm(`Ще обновите тема „${theme.name || theme.id}“ до версия ${theme.available_version}. Новата версия няма да бъде активирана автоматично. Да продължа ли?`)) return; self.themeBusy = theme.id; $.ajax({ url: "/api/themes/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ action: "update_remote", id: theme.id }) }).done((response: { themes?: ThemeRecord[] }) => { self.themes = response.themes ?? self.themes; showToast("Темата е обновена успешно.", "success") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Темата не можа да бъде обновена."; this.error = message; showToast(message, "error") }).always(() => { self.themeBusy = "" }) },
    rollbackTheme() { const self = this as typeof this & { themes: ThemeRecord[]; themeBusy: string }; if (self.themeBusy) return; self.themeBusy = "rollback"; $.ajax({ url: "/api/themes/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ action: "rollback" }) }).done((response: { themes?: ThemeRecord[] }) => { self.themes = response.themes ?? self.themes; showToast("Темата е върната към предходната.", "success") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Темата не можа да бъде върната."; this.error = message; showToast(message, "error") }).always(() => { self.themeBusy = "" }) },
    syncMedia() { this.isMobile = window.matchMedia("(max-width: 48rem)").matches; if (!this.isMobile) this.mobileOpen = false },
    toggleSidebar() { if (this.isMobile) { this.mobileOpen = !this.mobileOpen } else { this.collapsed = !this.collapsed; $.ajax({ url: "/admin/sidebar-width", method: "POST", data: { _token: this.csrfToken, collapsed: this.collapsed ? "1" : "0" }, headers: { "X-CSRF-Token": this.csrfToken } }) } },
    setSectionTransitionHeight(card: HTMLElement | null) { const body = card?.querySelector<HTMLElement>(":scope > .section-body"); if (!body) return; const wasHidden = getComputedStyle(body).display === "none"; if (wasHidden) body.style.display = "grid"; const height = body.scrollHeight; if (wasHidden) body.style.display = "none"; if (height > 0) body.style.setProperty("--section-content-height", `${height}px`); },
    toggleSection(key: string, element: HTMLElement) { const card = element.closest<HTMLElement>(".content-card"); this.setSectionTransitionHeight(card); this.collapsedSections[key] = !this.collapsedSections[key]; card?.classList.toggle("is-collapsed", this.collapsedSections[key]); $.ajax({ url: "/admin/section-state", method: "POST", data: { _token: this.csrfToken, key, collapsed: this.collapsedSections[key] ? "1" : "0" }, headers: { "X-CSRF-Token": this.csrfToken } }) },
    isSectionCollapsed(key: string) { return this.collapsedSections[key] === true },
    syncCollapsedSections() { document.querySelectorAll<HTMLElement>(".section-header[data-section-key]").forEach((header) => { const card = header.closest<HTMLElement>(".content-card"); this.setSectionTransitionHeight(card); card?.classList.toggle("is-collapsed", this.isSectionCollapsed(header.dataset.sectionKey ?? "")) }) },
    navigate(url: string, pushHistory = true) { this.loading = true; $.get(url, (markup: string) => { const next = new DOMParser().parseFromString(markup, "text/html").getElementById("flex-admin-bootstrap"); if (!next) return; const bootstrap = JSON.parse(next.textContent ?? "{}") as Bootstrap; this.applyBootstrap(bootstrap); this.remoteUpdate = bootstrap.remoteUpdate ?? this.remoteUpdate; this.updateJobs = bootstrap.updateJobs ?? []; if (pushHistory) window.history.pushState({}, "", url); window.scrollTo({ top: 0, behavior: "smooth" }) }, "html").fail(() => { this.error = "Страницата не можа да бъде заредена."; showToast(this.error, "error") }).always(() => { this.loading = false }) },
    pluginAction(action: "install" | "activate" | "deactivate" | "uninstall", plugin: PluginRecord) { if (action === "uninstall" && !window.confirm(`Сигурни ли сте, че искате да премахнете „${plugin.name}“? Това действие изтрива файловете на плъгина.`)) return; this.pluginBusy = plugin.id; $.ajax({ url: "/api/plugins/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ id: plugin.id, action }) }).done((response: { plugin?: PluginRecord }) => { showToast(action === "install" ? "Плъгинът е инсталиран." : action === "activate" ? "Плъгинът е активиран." : action === "deactivate" ? "Плъгинът е деактивиран." : "Плъгинът е премахнат.", "success"); if (action === "uninstall") { this.navigate("/admin/plugins"); return } if (response.plugin) { this.pluginDetail = response.plugin; this.plugins = this.plugins.map((item: PluginRecord) => item.id === response.plugin?.id ? response.plugin : item) } }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Операцията с плъгина не беше изпълнена."; this.error = message; showToast(message, "error") }).always(() => { this.pluginBusy = "" }) },
    installRemotePlugin(item: { id: string; name?: string; version?: string; minimum_php?: string; minimum_platform_version?: string; permissions?: string[] }) { const requirements = [`Версия: ${item.version ?? "—"}`, `Минимален PHP: ${item.minimum_php ?? "—"}`, `Минимална версия на платформата: ${item.minimum_platform_version || "няма"}`, `Разрешения: ${(item.permissions ?? []).join(", ") || "няма специални разрешения"}`].join("\n"); if (!window.confirm(`Ще инсталирате „${item.name || item.id}“.\n\n${requirements}\n\nДа продължа ли?`)) return; this.pluginBusy = item.id; $.ajax({ url: "/api/plugins/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ id: item.id, action: "install_remote" }) }).done(() => { showToast("Плъгинът е инсталиран от каталога.", "success"); this.navigate("/admin/plugins/catalog/" + encodeURI(item.id)) }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Плъгинът не можа да бъде инсталиран."; this.error = message; showToast(message, "error") }).always(() => { this.pluginBusy = "" }) },
    updateRemotePlugin(item: { id: string }) { if (this.pluginBusy) return; this.pluginBusy = item.id; $.ajax({ url: "/api/plugins/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ id: item.id, action: "update_remote" }) }).done(() => { showToast("Плъгинът е обновен успешно.", "success"); this.navigate("/admin/plugins/catalog/" + encodeURI(item.id)) }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Плъгинът не можа да бъде обновен."; this.error = message; showToast(message, "error") }).always(() => { this.pluginBusy = "" }) },
    rollbackRemotePlugin(plugin: PluginRecord) { if (!plugin.last_update_id || this.pluginBusy) return; if (!window.confirm("Сигурни ли сте, че искате да върнете предходната версия на плъгина?")) return; this.pluginBusy = plugin.id; $.ajax({ url: "/api/plugins/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ id: plugin.id, history_id: plugin.last_update_id, action: "rollback_remote" }) }).done(() => { showToast("Плъгинът е върнат към предходната версия.", "success"); this.navigate("/admin/plugins/" + encodeURI(plugin.id)) }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Rollback на плъгина не можа да бъде изпълнен."; this.error = message; showToast(message, "error") }).always(() => { this.pluginBusy = "" }) },
    uploadPlugin(event: Event) { const input = (event.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>('input[type="file"]'); const file = input?.files?.[0]; if (!file || this.pluginUploadBusy) return; const data = new FormData(); data.append("plugin", file); this.pluginUploadBusy = true; $.ajax({ url: "/api/plugins/upload", method: "POST", data, processData: false, contentType: false, dataType: "json", headers: { "X-CSRF-Token": this.csrfToken } }).done(() => { showToast("Плъгинът е качен и инсталиран.", "success"); this.navigate("/admin/plugins") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Плъгинът не можа да бъде качен."; this.error = message; showToast(message, "error") }).always(() => { this.pluginUploadBusy = false }) },
    approvePluginPermissions() { if (!this.pluginDetail || this.pluginPermissionBusy) return; this.pluginPermissionBusy = true; $.ajax({ url: "/api/plugins/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ id: this.pluginDetail.id, action: "approve_permissions", permissions: this.pluginPermissionDraft }) }).done((response: { plugin?: PluginRecord }) => { if (response.plugin) { this.pluginDetail = response.plugin; this.plugins = this.plugins.map((plugin: PluginRecord) => plugin.id === response.plugin?.id ? response.plugin : plugin) } showToast("Разрешенията са запазени.", "success") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Разрешенията не можаха да бъдат запазени."; this.error = message; showToast(message, "error") }).always(() => { this.pluginPermissionBusy = false }) },
    slugify(value: string) { return slugifyPageTitle(value) },
    saveTheme() { localStorage.setItem("flexcms.admin.theme", this.theme); document.documentElement.classList.remove("light", "dark"); document.documentElement.classList.add(this.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : this.theme) },
    startCreate() { this.navigate("/admin/pages/create") },
    startEdit(item: PageRecord) { this.navigate(`/admin/pages/${item.id}/edit`) },
    startSettings(item?: PageRecord) { const id = item?.id ?? this.editingId; if (id) this.navigate(`/admin/pages/${id}/settings`) },
    addContentBlock(type: ContentBlock["type"]) { this.form.blocks.push({ type, data: {} }) },
    removeContentBlock(index: number) { this.form.blocks.splice(index, 1) },
    toggleTrashMode() { this.selectedPageIds = []; this.trashMode = !this.trashMode; this.pageFilters = { ...this.pageFilters, view: this.trashMode ? "trash" : "active" }; writePageFiltersToUrl(this.pageFilters) },
    statusLabel(status: string) { return ({ draft: "Чернова", published: "Публикувана", active: "Активен", inactive: "Неактивен", installed: "Инсталиран", not_installed: "Не е инсталиран", discovered: "Открит", error: "Грешка", disabled: "Деактивиран", pending: "Изчаква", running: "Изпълнява се", completed: "Завършено", failed: "Неуспешно", queued: "На опашка" } as Record<string, string>)[status] ?? status },
    filteredPageRows() { const rows = this.trashMode ? this.trashedPages : this.pages; return rows.filter((row) => { const statusMatches = this.pageFilters.status === "all" || row.status === this.pageFilters.status; const structureMatches = this.pageFilters.structure === "all" || (this.pageFilters.structure === "root" && !row.parent_id) || (this.pageFilters.structure === "child" && Boolean(row.parent_id)); return statusMatches && structureMatches }) },
    filteredUserRows() { return this.userList.filter((row) => (this.userFilters.role === "all" || row.role === this.userFilters.role) && (this.userFilters.status === "all" || row.status === this.userFilters.status)) },
    pageFilterCount() { return (this.pageFilters.status !== "all" ? 1 : 0) + (this.pageFilters.structure !== "all" ? 1 : 0) + (this.pageFilters.view !== "active" ? 1 : 0) },
    userFilterCount() { return (this.userFilters.role !== "all" ? 1 : 0) + (this.userFilters.status !== "all" ? 1 : 0) },
    startUserEdit(row: { id: number }) { this.navigate(`/admin/users/${row.id}/edit`) },
    toggleUserStatus(row: { id: number; name: string; email: string; role: string; status: string }) { if (this.userBusy !== null) return; const status = row.status === "active" ? "disabled" : "active"; this.userBusy = row.id; $.ajax({ url: `/api/users/${row.id}`, method: "PATCH", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ name: row.name, email: row.email, role: row.role, status }) }).done((response: { user?: { id: number; name: string; email: string; role: string; status: string } }) => { if (response.user) this.userList = this.userList.map((item) => item.id === response.user?.id ? response.user : item); showToast(status === "active" ? "Потребителят е активиран." : "Потребителят е деактивиран.", "success") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Статусът на потребителя не можа да бъде променен."; this.error = message; showToast(message, "error") }).always(() => { this.userBusy = null }) },
    openUserDeleteModal(row: { id: number; name: string; email: string }) { this.userDeleteModal = { open: true, user: row, busy: false } },
    closeUserDeleteModal() { if (!this.userDeleteModal.busy) this.userDeleteModal.open = false },
    confirmUserDelete() { const user = this.userDeleteModal.user; if (!user) return; this.userDeleteModal.busy = true; $.ajax({ url: `/api/users/${user.id}`, method: "DELETE", headers: { "X-CSRF-Token": this.csrfToken } }).done(() => { this.userList = this.userList.filter((item) => item.id !== user.id); this.selectedUserIds = this.selectedUserIds.filter((id) => id !== user.id); this.users = this.userList.length; this.userDeleteModal.open = false; showToast("Потребителят е изтрит.", "success") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Потребителят не можа да бъде изтрит."; this.error = message; showToast(message, "error") }).always(() => { this.userDeleteModal.busy = false }) },
    toggleUserRowSelection(id: number) { this.selectedUserIds = this.selectedUserIds.includes(id) ? this.selectedUserIds.filter((item) => item !== id) : [...this.selectedUserIds, id] },
    allVisibleUserRowsSelected() { const rows = this.filteredUserRows(); return rows.length > 0 && rows.every((row) => this.selectedUserIds.includes(row.id)) },
    toggleAllVisibleUserRows(checked: boolean) { const visibleIds = this.filteredUserRows().map((row) => row.id); this.selectedUserIds = checked ? [...new Set([...this.selectedUserIds, ...visibleIds])] : this.selectedUserIds.filter((id) => !visibleIds.includes(id)) },
    openUserBulkModal() { if (this.selectedUserIds.length === 0) return; this.userBulkModal = { open: true, action: "activate", busy: false } },
    closeUserBulkModal() { if (!this.userBulkModal.busy) this.userBulkModal.open = false },
    applyUserBulkAction() { const ids = [...this.selectedUserIds]; if (!ids.length) return; this.userBulkModal.busy = true; const action = this.userBulkModal.action; const run = (index: number): void => { if (index >= ids.length) { this.userBulkModal.open = false; this.selectedUserIds = []; this.userBulkModal.busy = false; this.users = this.userList.length; showToast("Масовото действие е изпълнено.", "success"); return } const id = ids[index]; const current = this.userList.find((item) => item.id === id); if (!current) { run(index + 1); return } const request: JQuery.AjaxSettings = { url: `/api/users/${id}`, method: action === "delete" ? "DELETE" : "PATCH", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken } }; if (action !== "delete") { request.contentType = "application/json"; request.data = JSON.stringify({ name: current.name, email: current.email, role: current.role, status: action === "activate" ? "active" : "disabled" }) } $.ajax(request).done((response: { user?: { id: number; name: string; email: string; role: string; status: string } }) => { this.userList = action === "delete" ? this.userList.filter((item) => item.id !== id) : this.userList.map((item) => item.id === id && response.user ? response.user : item); run(index + 1) }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Масовото действие не беше изпълнено."; this.error = message; this.userBulkModal.busy = false; showToast(message, "error") }) }; run(0) },
    openUserFilterModal() { this.draftUserFilters = { ...this.userFilters }; this.userFilterModalOpen = true },
    closeUserFilterModal() { this.userFilterModalOpen = false },
    resetUserFilters() { this.draftUserFilters = { role: "all", status: "all" } },
    applyUserFilters() { this.userFilters = { ...this.draftUserFilters }; writeUserFiltersToUrl(this.userFilters); this.selectedUserIds = []; this.userFilterModalOpen = false },
    toggleRowSelection(id: number) { this.selectedPageIds = this.selectedPageIds.includes(id) ? this.selectedPageIds.filter((item) => item !== id) : [...this.selectedPageIds, id] },
    allVisibleRowsSelected() { const rows = this.filteredPageRows(); return rows.length > 0 && rows.every((row) => this.selectedPageIds.includes(row.id)) },
    toggleAllVisibleRows(checked: boolean) { const visibleIds = this.filteredPageRows().map((row) => row.id); this.selectedPageIds = checked ? [...new Set([...this.selectedPageIds, ...visibleIds])] : this.selectedPageIds.filter((id) => !visibleIds.includes(id)) },
    openBulkModal() { if (this.selectedPageIds.length === 0) return; this.bulkModal = { open: true, action: this.trashMode ? "force" : "trash", busy: false, settings: { use_parent_slugs: false, no_index: false, show_in_navigation: true, show_in_sitemap: true } } },
    closeBulkModal() { if (!this.bulkModal.busy) this.bulkModal.open = false },
    applyBulkAction() { const ids = [...this.selectedPageIds]; if (!ids.length) return; this.bulkModal.busy = true; const action = this.bulkModal.action; const settings = { ...this.bulkModal.settings }; const run = (index: number): void => { if (index >= ids.length) { this.bulkModal.open = false; this.selectedPageIds = []; this.bulkModal.busy = false; showToast("Масовото действие е изпълнено.", "success"); this.navigate("/admin/pages"); return } const id = ids[index]; const url = action === "trash" ? `/api/pages/${id}` : action === "force" ? `/api/pages/${id}/force` : `/api/pages/${id}/settings`; const request: JQuery.AjaxSettings = { url, method: action === "settings" ? "PATCH" : "DELETE", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken } }; if (action === "settings") { request.contentType = "application/json"; request.data = JSON.stringify(settings) } $.ajax(request).done(() => run(index + 1)).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Масовото действие не беше изпълнено."; this.error = message; this.bulkModal.busy = false; showToast(message, "error") }) }; run(0) },
    togglePageStatus(row: PageRecord) { const status = row.status === "published" ? "draft" : "published"; $.ajax({ url: `/api/pages/${row.id}/status`, method: "PATCH", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ status }) }).done((response: { page?: PageRecord }) => { if (response.page) this.pages = this.pages.map((page) => page.id === response.page?.id ? response.page : page); showToast(status === "published" ? "Страницата е публикувана." : "Страницата е върната в чернова.", "success") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Статусът на страницата не можа да бъде променен."; this.error = message; showToast(message, "error") }) },
    openFilterModal() { this.draftPageFilters = { ...this.pageFilters }; this.filterModalOpen = true },
    closeFilterModal() { this.filterModalOpen = false },
    applyPageFilters() { this.pageFilters = { ...this.draftPageFilters }; this.trashMode = this.pageFilters.view === "trash"; writePageFiltersToUrl(this.pageFilters); this.filterModalOpen = false },
    resetPageFilters() { this.draftPageFilters = { status: "all", structure: "all", view: "active" } },
    openPageModal(action: "trash" | "restore" | "force", page: PageRecord) { const restore = action === "restore"; this.pageModal = { open: true, action, page, busy: false, title: restore ? "Възстановяване на страница" : action === "trash" ? "Преместване в кошчето" : "Окончателно изтриване", message: restore ? `Сигурни ли сте, че искате да възстановите „${page.title}“?` : action === "trash" ? `Сигурни ли сте, че искате да преместите „${page.title}“ в кошчето?` : `Сигурни ли сте, че искате да изтриете завинаги „${page.title}“? Това действие не може да бъде отменено.`, confirmLabel: restore ? "Възстанови" : action === "trash" ? "Премести в кошчето" : "Изтрий завинаги" } },
    closePageModal() { if (!this.pageModal.busy) this.pageModal.open = false },
    confirmPageAction() { const page = this.pageModal.page; if (!page) return; this.pageModal.busy = true; const restore = this.pageModal.action === "restore"; const url = restore ? `/api/pages/${page.id}/restore` : this.pageModal.action === "trash" ? `/api/pages/${page.id}` : `/api/pages/${page.id}/force`; const method = restore ? "POST" : "DELETE"; $.ajax({ url, method, dataType: "json", headers: { "X-CSRF-Token": this.csrfToken } }).done(() => { showToast(restore ? "Страницата е възстановена." : this.pageModal.action === "trash" ? "Страницата е преместена в кошчето." : "Страницата е изтрита завинаги.", "success"); this.pageModal.open = false; this.navigate("/admin/pages") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Операцията не беше изпълнена."; this.error = message; showToast(message, "error") }).always(() => { this.pageModal.busy = false }) },
    saveUser() { if (this.userSaving) return; this.userSaving = true; $.ajax({ url: this.userEditingId ? `/api/users/${this.userEditingId}` : "/api/users", method: this.userEditingId ? "PATCH" : "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify(this.userForm) }).done((response: { user?: { id: number; name: string; email: string; role: string; status: string } }) => { if (response.user) { this.userList = this.userEditingId ? this.userList.map((item) => item.id === response.user?.id ? response.user : item) : [response.user, ...this.userList]; this.users = this.userList.length; this.userForm.password = ""; showToast(this.userEditingId ? "Потребителят е обновен." : "Потребителят е създаден.", "success"); if (!this.userEditingId && response.user?.id) this.navigate(`/admin/users/${response.user.id}/edit`) } }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Потребителят не можа да бъде създаден."; this.error = message; showToast(message, "error") }).always(() => { this.userSaving = false }) },    saveUserPassword() { if (!this.userEditingId || !this.userPassword || this.userPasswordSaving) return; if (this.userPassword !== this.userPasswordConfirmation) { this.error = "Паролите не съвпадат."; showToast(this.error, "error"); return; } this.userPasswordSaving = true; $.ajax({ url: `/api/users/${this.userEditingId}`, method: "PATCH", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ name: this.userForm.name, email: this.userForm.email, role: this.userForm.role, status: this.userForm.status, password: this.userPassword, current_password: this.userPasswordCurrent }) }).done(() => { this.userPasswordCurrent = ""; this.userPassword = ""; this.userPasswordConfirmation = ""; showToast("Паролата е сменена.", "success") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Паролата не можа да бъде сменена."; this.error = message; showToast(message, "error") }).always(() => { this.userPasswordSaving = false }) },    savePage() { const payload = { ...this.form, plugin_fields: this.pluginFields, parent_id: this.form.parentId === "" ? null : Number(this.form.parentId) }; const parsed = pageFormSchema.safeParse(payload); if (!parsed.success) { this.fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])) as FieldErrors; this.error = "Моля, поправете маркираните полета."; showToast(this.error, "error"); return } this.saving = true; const creating = this.editingId === null; $.ajax({ url: creating ? "/api/pages" : `/api/pages/${this.editingId}`, method: creating ? "POST" : "PATCH", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify(parsed.data) }).done((response: { page?: PageRecord }) => { showToast(creating ? "Страницата е създадена." : "Страницата е обновена.", "success"); if (creating && response.page?.id) this.navigate(`/admin/pages/${response.page.id}/edit`) }).fail((xhr: JQuery.jqXHR) => { const details = (xhr.responseJSON?.error?.details?.fields ?? {}) as Record<string, string[]>; this.fieldErrors = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value[0]])) as FieldErrors; this.error = xhr.responseJSON?.error?.message ?? "Неуспешно записване на страницата."; showToast(this.error, "error") }).always(() => { this.saving = false }) },
    savePageSettings() { if (!this.editingId) return; this.saving = true; const payload = { ...this.pageSettings, plugin_settings: this.pluginSettings }; $.ajax({ url: `/api/pages/${this.editingId}/settings`, method: "PATCH", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify(payload) }).done((response: { page?: PageRecord }) => { if (response.page?.settings) this.pageSettings = response.page.settings; showToast("Настройките са запазени.", "success") }).fail((xhr: JQuery.jqXHR) => { this.error = xhr.responseJSON?.error?.message ?? "Настройките не можаха да бъдат запазени."; showToast(this.error, "error") }).always(() => { this.saving = false }) },
    applyBootstrap(next: Bootstrap) { this.userList = next.userList ?? this.userList; this.page = next.page; this.pageTitle = ({ dashboard: "Табло", updates: "Обновявания", pages: "Страници", "pages-create": "Създаване на страница", "pages-edit": "Редактиране на страница", "pages-settings": "Настройки на страница", profile: "Профил", users: "Потребители", plugins: "Разширения", "plugin-catalog": "Каталог с разширения", "plugin-detail": "Детайли на разширение", "plugin-catalog-detail": "Детайли на разширение" } as Record<string, string>)[next.page]; this.csrfToken = next.csrfToken; this.width = next.sidebarWidth; this.collapsed = next.sidebarCollapsed ?? false; this.collapsedSections = next.collapsedSections ?? {}; this.pages = next.pages ?? this.pages; this.trashedPages = next.trashedPages ?? this.trashedPages; this.plugins = next.plugins ?? this.plugins; this.pluginCatalog = next.pluginCatalog ?? this.pluginCatalog; this.catalogDetail = next.catalogDetail ?? null; this.pluginDetail = next.pluginDetail ?? null; this.userData = next.userData ?? null; this.userEditingId = next.userData?.id ?? null; if (next.userData) { this.userForm = { name: next.userData.name, email: next.userData.email, password: "", role: next.userData.role, status: next.userData.status }; this.userPasswordCurrent = ""; this.userPassword = ""; this.userPasswordConfirmation = ""; } this.pluginPermissionDraft = next.pluginDetail?.approved_permissions ?? []; this.pageFields = next.pageFields ?? this.pageFields; this.pageSettingsFields = next.pageSettingsFields ?? this.pageSettingsFields; this.selectedPageIds = []; this.selectedUserIds = []; this.bulkModal.open = false; this.userBulkModal.open = false; if (next.page === "pages") { this.pageFilters = readPageFiltersFromUrl(); this.draftPageFilters = { ...this.pageFilters }; this.trashMode = this.pageFilters.view === "trash" } if (next.page === "users") { this.userFilters = readUserFiltersFromUrl(); this.draftUserFilters = { ...this.userFilters } } this.history = next.history ?? []; this.notice = next.notice ?? ""; this.error = next.error ?? ""; this.inspection = next.inspection; const pageData = next.pageData ?? null; this.editingId = pageData?.id ?? null; this.pluginFields = pageFieldValues(this.pageFields, pageData?.plugin_fields); this.pluginSettings = pageFieldValues(this.pageSettingsFields, pageData?.plugin_settings); this.form = pageData ? { title: pageData.title, slug: pageData.slug, content: pageData.content, blocks: pageData.blocks ?? [], parentId: pageData.parent_id ?? "", status: pageData.status } : { title: "", slug: "", content: "", blocks: [], parentId: "", status: "draft" }; this.pageSettings = pageData?.settings ? { ...this.pageSettings, ...pageData.settings } : { seo_title: "", meta_description: "", canonical_url: "", template: "default", menu_order: 0, use_parent_slugs: false, no_index: false, show_in_navigation: true, show_in_sitemap: true }; this.slugManuallyEdited = false; this.fieldErrors = {}; this.mobileOpen = false; setTimeout(() => this.syncCollapsedSections(), 0) },
  }
  const initialPageData = initial.pageData ?? null
  state.editingId = initialPageData?.id ?? null
  state.pluginFields = pageFieldValues(state.pageFields, initialPageData?.plugin_fields)
  state.pluginSettings = pageFieldValues(state.pageSettingsFields, initialPageData?.plugin_settings)
  Object.defineProperty(state, "themes", { value: initial.themes ?? [], writable: true, enumerable: true, configurable: true })
  Object.defineProperty(state, "themeCatalog", { value: initial.themeCatalog ?? [], writable: true, enumerable: true, configurable: true })
  Object.defineProperty(state, "themeBusy", { value: "", writable: true, enumerable: true, configurable: true })
  const dynamicState = state as typeof state & { themes: ThemeRecord[]; themeCatalog: ThemeCatalogRecord[]; themeBusy: string; installRemoteTheme: (item: ThemeCatalogRecord) => void; deactivateTheme: (item: ThemeRecord) => void; deleteTheme: (item: ThemeRecord) => void }
  dynamicState.installRemoteTheme = (item) => {
    if (dynamicState.themeBusy || item.installation_status !== "not_installed") return
    if (!window.confirm(`Ще инсталирате тема „${item.name || item.id}“ версия ${item.version}. Да продължа ли?`)) return
    dynamicState.themeBusy = item.id
    $.ajax({ url: "/api/themes/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": initial.csrfToken }, data: JSON.stringify({ action: "install_remote", id: item.id }) }).done((response: { themes?: ThemeRecord[] }) => {
      dynamicState.themes = response.themes ?? dynamicState.themes
      dynamicState.themeCatalog = dynamicState.themeCatalog.map((theme) => theme.id === item.id ? { ...theme, installed: true, active: false, installed_version: item.version, installation_status: "installed" } : theme)
      showToast("Темата е инсталирана успешно.", "success")
    }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Темата не можа да бъде инсталирана."; showToast(message, "error") }).always(() => { dynamicState.themeBusy = "" })
  }
  dynamicState.deactivateTheme = (item) => {
    if (dynamicState.themeBusy || !item.active) return
    dynamicState.themeBusy = item.id
    $.ajax({ url: "/api/themes/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": initial.csrfToken }, data: JSON.stringify({ action: "deactivate", id: item.id }) }).done((response: { themes?: ThemeRecord[] }) => {
      dynamicState.themes = response.themes ?? dynamicState.themes
      dynamicState.themeCatalog = dynamicState.themeCatalog.map((theme) => theme.id === item.id ? { ...theme, active: false, installation_status: "installed" } : theme)
      showToast("Темата е деактивирана.", "success")
    }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Темата не можа да бъде деактивирана."; dynamicState.error = message; showToast(message, "error") }).always(() => { dynamicState.themeBusy = "" })
  }
  dynamicState.deleteTheme = (item) => {
    if (dynamicState.themeBusy || item.active) return
    if (!window.confirm(`Сигурни ли сте, че искате да изтриете тема „${item.name || item.id}“? Файловете ѝ ще бъдат премахнати от инсталацията.`)) return
    dynamicState.themeBusy = item.id
    $.ajax({ url: "/api/themes/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": initial.csrfToken }, data: JSON.stringify({ action: "delete", id: item.id }) }).done((response: { themes?: ThemeRecord[] }) => {
      dynamicState.themes = response.themes ?? dynamicState.themes.filter((theme) => theme.id !== item.id)
      dynamicState.themeCatalog = dynamicState.themeCatalog.map((theme) => theme.id === item.id ? { ...theme, installed: false, active: false, installed_version: null, installation_status: "not_installed" } : theme)
      showToast("Темата е изтрита от инсталацията.", "success")
    }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Темата не можа да бъде изтрита."; dynamicState.error = message; showToast(message, "error") }).always(() => { dynamicState.themeBusy = "" })
  }
  state.form = initialPageData ? { title: initialPageData.title, slug: initialPageData.slug, content: initialPageData.content, blocks: initialPageData.blocks ?? [], parentId: initialPageData.parent_id ?? "", status: initialPageData.status } : state.form
  state.pageSettings = initialPageData?.settings ? { ...state.pageSettings, ...initialPageData.settings } : state.pageSettings
  state.pluginDetail = initial.pluginDetail ?? null
  state.adminExtensions = initial.adminExtensions ?? { sidebar: [], slots: {} }
  state.pluginPermissionDraft = initial.pluginDetail?.approved_permissions ?? []
  state.pageTitle = ({ dashboard: "Табло", updates: "Обновявания", users: "Потребители", "users-create": "Създаване на потребител", "users-edit": "Редактиране на потребител", pages: "Страници", "pages-create": "Създаване на страница", "pages-edit": "Редактиране на страница", "pages-settings": "Настройки на страница", profile: "Профил", plugins: "Разширения", "plugin-catalog": "Каталог с разширения", "plugin-detail": "Детайли на разширение", "plugin-catalog-detail": "Детайли на разширение" } as Record<string, string>)[initial.page]
  state.pageTitle = initial.page === "themes" ? "Теми" : state.pageTitle
  state.pageTitle = initial.page === "theme-catalog" ? "Каталог с теми" : state.pageTitle
  return state
}

const initial = readBootstrap()
Alpine.data("loginForm", () => ({ submitting: false }))
registerRichTextEditor(Alpine)
registerCodeEditor(Alpine)
registerDataTable(Alpine)
if (root && initial) {
  const adminState = createAdminState(initial)
  Alpine.data("adminApp", () => adminState)
  root.innerHTML = adminMarkup()
  window.addEventListener("popstate", () => { adminState.navigate(window.location.href, false) })
  window.addEventListener("flexcms-theme-deactivate", (event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id
    const themeState = adminState as typeof adminState & { themes: ThemeRecord[]; deactivateTheme: (item: ThemeRecord) => void }
    const theme = themeState.themes.find((item) => item.id === id)
    if (theme) themeState.deactivateTheme(theme)
  })
  if (initial.notice) showToast(initial.notice, "success")
  if (initial.error) showToast(initial.error, "error")
}

Alpine.start()

if (root) {
  const breadcrumbObserver = new MutationObserver(() => {
    window.requestAnimationFrame(() => {
      alignBreadcrumbsBelowDescription()
      groupPageSettingsCheckboxes()
    })
  })
  breadcrumbObserver.observe(root, { childList: true, subtree: true })
  window.requestAnimationFrame(() => {
    alignBreadcrumbsBelowDescription()
    groupPageSettingsCheckboxes()
  })
}
