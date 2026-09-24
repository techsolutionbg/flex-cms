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
import { pageFormSchema, slugifyPageTitle } from "@/lib/page-validation"
import "@/styles/globals.css"

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
  installed_at: string | null
  activated_at: string | null
  last_error: string | null
  requested_permissions?: string[]
  approved_permissions?: string[]
  manifest?: Record<string, unknown>
}

type Bootstrap = {
  page: "dashboard" | "updates" | "profile" | "pages" | "pages-create" | "pages-edit" | "pages-settings" | "plugins" | "plugin-detail"
  csrfToken: string
  sidebarWidth: number
  sidebarCollapsed?: boolean
  collapsedSections?: Record<string, boolean>
  version: string
  user?: { name: string; email: string; role: string; status: string }
  pages?: PageRecord[]
  trashedPages?: PageRecord[]
  pageData?: PageRecord | null
  history?: Array<Record<string, string | boolean | undefined>>
  notice?: string | null
  error?: string | null
  inspection?: { version?: string; files?: number; migrations?: boolean } | null
  plugins?: PluginRecord[]
  pluginDetail?: PluginRecord | null
  adminExtensions?: {
    sidebar: Array<{ id: string; label: string; href: string }>
    slots: Record<string, Array<{ kind: "notice" | "card" | "link"; title: string; text: string; href: string | null }>>
  }
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

function sectionHeader(title: string, key: string, expression?: string): string {
  const titleAttributes = expression ? ` x-text="${expression}"` : ""
  return `<button class="section-header" data-section-key="${key}" type="button" @click="toggleSection('${key}', $el)" :aria-expanded="!isSectionCollapsed('${key}')"><span${titleAttributes}>${title}</span><svg class="section-chevron" :class="{ 'is-collapsed': isSectionCollapsed('${key}') }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>`
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

function contentBlocksMarkup(): string {
  return `<section class="content-card content-blocks-card"><header><div class="section-heading"><h2>Content blocks</h2><p>Добавяйте структурирани елементи към страницата.</p></div></header><div class="section-body"><div class="content-block-list"><template x-for="(block, index) in form.blocks" :key="index"><article class="content-block-item"><div class="content-block-item-header"><strong x-text="block.type"></strong><button class="button secondary" type="button" @click="removeContentBlock(index)">Премахни</button></div><select class="form-control" x-model="block.type"><option value="paragraph">Параграф</option><option value="heading">Заглавие</option><option value="image">Изображение</option><option value="button">Бутон</option></select><textarea class="form-control" x-model="block.data.text" x-show="block.type === 'paragraph' || block.type === 'heading'" rows="3" placeholder="Текст на блока"></textarea><div class="content-block-two-column" x-show="block.type === 'image'"><input class="form-control" type="url" x-model="block.data.url" placeholder="URL на изображението"><input class="form-control" type="text" x-model="block.data.alt" placeholder="Алтернативен текст"></div><div class="content-block-two-column" x-show="block.type === 'button'"><input class="form-control" type="text" x-model="block.data.label" placeholder="Текст на бутона"><input class="form-control" type="url" x-model="block.data.url" placeholder="URL адрес"></div></article></template></div><button class="button secondary" type="button" @click="addContentBlock('paragraph')">Добави content block</button></div></section>`
}

function adminSlotMarkup(name: string): string {
  return `<div class="admin-extension-slot" x-show="(adminExtensions.slots['${name}'] || []).length"><template x-for="item in (adminExtensions.slots['${name}'] || [])" :key="item.kind + item.title"><div x-show="item.kind === 'notice'" class="notice info"><strong x-text="item.title"></strong><span x-text="item.text"></span></div><article x-show="item.kind === 'card'" class="content-card admin-extension-card"><h2 x-text="item.title"></h2><p x-text="item.text"></p></article><a x-show="item.kind === 'link'" class="admin-extension-link" :href="item.href" @click.prevent="navigate(item.href)"><strong x-text="item.title"></strong><span x-text="item.text"></span></a></template></div>`
}

function adminSidebarMarkup(): string {
  return `<template x-for="item in adminExtensions.sidebar" :key="item.id"><li><a class="sidebar-link" :href="item.href" @click.prevent="navigate(item.href)"><span class="sidebar-link-label" x-text="item.label"></span></a></li></template>`
}

function adminMarkup(): string {
  const markup = `
    <div class="admin-shell sidebar-enhanced" x-data="adminApp" :class="{ 'sidebar-collapsed': collapsed, 'sidebar-mobile-open': mobileOpen }" :style="\`--sidebar-width: \${width}px\`"><div class="admin-loading-bar" x-show="loading" x-cloak></div>
      <aside id="admin-sidebar" class="admin-sidebar" :aria-hidden="isMobile && !mobileOpen">
        <div class="sidebar-brand"><img class="sidebar-logo" src="/assets/brand/logo.png" alt="Flex CMS"></div>
        <nav aria-label="Административна навигация"><ul class="sidebar-nav-list">
          <li><a class="sidebar-link" href="/admin" :class="{ 'is-active': page === 'dashboard' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-8Z" /></svg><span class="sidebar-link-label">Табло</span></a></li>
          <li><a class="sidebar-link" href="/admin/updates" :class="{ 'is-active': page === 'updates' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.8-4M4 5v4h4M4 13a8 8 0 0 0 14.8 4M20 19v-4h-4" /></svg><span class="sidebar-link-label">Обновявания</span></a></li>
          <li><a class="sidebar-link" href="/admin/plugins" :class="{ 'is-active': page === 'plugins' || page === 'plugin-detail' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v4M16 3v4M5 8h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8Zm3 4h8M8 16h5" /></svg><span class="sidebar-link-label">Разширения</span></a></li>
          <li><a class="sidebar-link" href="/admin/pages" :class="{ 'is-active': page === 'pages' || page === 'pages-create' || page === 'pages-edit' || page === 'pages-settings' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Zm9 0v4h3M9 12h6M9 16h6M9 8h2" /></svg><span class="sidebar-link-label">Страници</span></a></li>
          <li><a class="sidebar-link" href="/admin/profile" :class="{ 'is-active': page === 'profile' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg><span class="sidebar-link-label">Профил</span></a></li>
        </ul></nav>
      </aside>
      <button class="sidebar-backdrop" type="button" aria-label="Затвори страничната лента" x-show="mobileOpen" @click="mobileOpen = false"></button>
      <div class="admin-main">
        <header class="admin-topbar"><button class="sidebar-toggle" type="button" aria-label="Покажи или прибери страничната лента" @click="toggleSidebar" :aria-expanded="!collapsed || mobileOpen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button><div class="topbar-title" x-text="pageTitle"></div><div class="topbar-actions"><form method="post" action="/logout"><input type="hidden" name="_token" :value="csrfToken"><button class="logout" type="submit">Изход</button></form></div></header>
        <main class="admin-content">
          <template x-if="page === 'dashboard'"><section>${breadcrumbsMarkup("'Табло'", [], "page === 'dashboard'")}<h1>Административен панел</h1><p class="lead">Имате пълен достъп до системната администрация като супер администратор.</p><section class="dashboard-grid"><article class="content-card"><header>${sectionHeader("Потребители", "dashboard-users")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-users')"><p>Управление на потребители, роли и статуси.</p><a href="/api/users">Отвори API →</a></div></article><article class="content-card"><header>${sectionHeader("Обновявания", "dashboard-updates")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-updates')"><p>Проверка, инсталация и връщане на подписани platform пакети.</p><a href="/admin/updates" @click.prevent="navigate('/admin/updates')">Отвори обновявания →</a></div></article></section></section></template>
          <template x-if="page === 'profile'"><section>${breadcrumbsMarkup("'Профил'")}<h1>Профил</h1><p class="lead">Основни данни за текущия потребител.</p><section class="content-card profile-card"><header>${sectionHeader("Данни на потребителя", "profile-details")}</header><div class="section-body" x-show="!isSectionCollapsed('profile-details')"><dl class="profile-details"><div><dt>Име</dt><dd x-text="user.name"></dd></div><div><dt>Имейл</dt><dd x-text="user.email"></dd></div><div><dt>Роля</dt><dd x-text="user.role"></dd></div><div><dt>Статус</dt><dd x-text="user.status"></dd></div></dl></div></section><section class="content-card profile-card"><header>${sectionHeader("Настройки на темата", "profile-theme")}</header><div class="section-body" x-show="!isSectionCollapsed('profile-theme')"><label class="profile-setting"><span class="field-label">Тема на приложението${fieldHintMarkup("Изберете светла, тъмна или системна тема. При системна тема се използва настройката на операционната система.")}</span><select x-model="theme" @change="saveTheme"><option value="system">Системна</option><option value="light">Светла</option><option value="dark">Тъмна</option></select></label></div></section></section></template>
          <template x-if="page === 'plugins'"><section><div class="page-heading-row"><div><h1>Разширения</h1><p class="lead">Управлявайте разширенията, които добавят функционалност към Flex CMS.</p></div></div>${breadcrumbsMarkup("'Разширения'")}<div class="notice error" x-show="error" x-text="error"></div><div class="pages-table table-wrapper"><table><thead><tr><th>Име</th><th>ID</th><th>Версия</th><th>Статус</th><th>Действия</th></tr></thead><tbody><template x-for="plugin in plugins" :key="plugin.id"><tr><td><a class="table-link" :href="'/admin/plugins/' + plugin.id" x-text="plugin.name"></a><small class="table-cell-secondary" x-text="plugin.description"></small><small class="table-cell-secondary" x-show="plugin.last_error" x-text="plugin.last_error"></small></td><td x-text="plugin.id"></td><td x-text="plugin.version"></td><td><span class="status-badge" x-text="plugin.status === 'active' ? 'Активен' : plugin.status === 'error' ? 'Грешка' : plugin.status === 'installed' || plugin.status === 'inactive' ? 'Неактивен' : 'Открит'"></span></td><td class="table-actions"><button class="button secondary" type="button" x-show="plugin.status === 'discovered' || plugin.status === 'error'" :disabled="pluginBusy === plugin.id" @click="pluginAction('install', plugin)" x-text="pluginBusy === plugin.id ? 'Изпълнение…' : 'Инсталирай'"></button><button class="button secondary" type="button" x-show="plugin.status === 'installed' || plugin.status === 'inactive'" :disabled="pluginBusy === plugin.id" @click="pluginAction('activate', plugin)" x-text="pluginBusy === plugin.id ? 'Изпълнение…' : 'Активирай'"></button><button class="button secondary" type="button" x-show="plugin.status === 'active'" :disabled="pluginBusy === plugin.id" @click="pluginAction('deactivate', plugin)" x-text="pluginBusy === plugin.id ? 'Изпълнение…' : 'Деактивирай'"></button><button class="button danger" type="button" x-show="plugin.status === 'inactive' || plugin.status === 'installed' || plugin.status === 'error'" :disabled="pluginBusy === plugin.id" @click="pluginAction('uninstall', plugin)">Премахни</button></td></tr></template><tr x-show="plugins.length === 0"><td colspan="5" class="empty-state">Няма открити плъгини.</td></tr></tbody></table></div></section></template>
          <template x-if="page === 'plugin-detail'"><section><div class="page-heading-row"><div><h1 x-text="pluginDetail?.name"></h1><p class="lead" x-text="pluginDetail?.description || 'Подробности и lifecycle управление на разширението.'"></p></div><div class="page-heading-actions"><button class="button secondary" type="button" @click="navigate('/admin/plugins')">Назад към разширенията</button><button class="button secondary" type="button" x-show="pluginDetail?.status === 'installed' || pluginDetail?.status === 'inactive'" @click="pluginAction('activate', pluginDetail)">Активирай</button><button class="button secondary" type="button" x-show="pluginDetail?.status === 'active'" @click="pluginAction('deactivate', pluginDetail)">Деактивирай</button></div></div>${breadcrumbsMarkup("pluginDetail?.name ?? 'Разширение'", [{ label: "Разширения", href: "/admin/plugins" }])}<div class="plugin-detail-grid"><section class="content-card"><header>${sectionHeader("Основна информация", "plugin-detail-info")}</header><div class="section-body plugin-detail-list"><div><span>ID</span><strong x-text="pluginDetail?.id"></strong></div><div><span>Версия</span><strong x-text="pluginDetail?.version"></strong></div><div><span>Entrypoint</span><strong x-text="pluginDetail?.entrypoint"></strong></div><div><span>Път</span><strong x-text="pluginDetail?.path"></strong></div><div><span>Статус</span><strong x-text="pluginDetail?.status"></strong></div></div></section><section class="content-card"><header>${sectionHeader("Разрешения", "plugin-detail-permissions")}</header><div class="section-body plugin-permissions"><p class="field-hint">Одобрете само разрешенията, от които плъгинът действително се нуждае. Активирането е блокирано, докато всички заявени разрешения не бъдат одобрени.</p><template x-for="permission in (pluginDetail?.requested_permissions || [])" :key="permission"><label class="checkbox-row"><input type="checkbox" :value="permission" x-model="pluginPermissionDraft"><span x-text="permission"></span></label></template><p class="table-cell-secondary" x-show="(pluginDetail?.requested_permissions || []).length === 0">Плъгинът не заявява специални разрешения.</p><button class="button primary" type="button" :disabled="pluginDetail?.status === 'active'" @click="approvePluginPermissions()">Запази разрешенията</button></div></section><section class="content-card"><header>${sectionHeader("Manifest", "plugin-detail-manifest")}</header><div class="section-body"><pre class="plugin-manifest" x-text="JSON.stringify(pluginDetail?.manifest || {}, null, 2)"></pre></div></section></div><div class="notice error" x-show="pluginDetail?.last_error" x-text="pluginDetail?.last_error"></div></section></template>
          <template x-if="page === 'pages'"><section>${breadcrumbsMarkup("'Страници'")}<div class="page-heading-row pages-heading"><div><h1 x-text="trashMode ? 'Кошче' : 'Страници'"></h1>${collapsibleTextMarkup("Тук управлявате съдържанието на сайта — създавате нови страници, редактирате съществуващи и организирате страниците в родителска йерархия. Използвайте „Нова страница“, за да добавите страница. В таблицата можете да сортирате по име, slug, статус или дата на обновяване, а чрез менюто „Действия“ да редактирате съдържанието, статуса и родителската страница.")}</div><div class="page-heading-actions"><button class="button secondary bulk-action-trigger" type="button" @click="openBulkModal" :disabled="selectedPageIds.length === 0">Масови действия<span x-show="selectedPageIds.length > 0" x-text="\` (\${selectedPageIds.length})\`"></span></button><button class="button secondary" type="button" @click="openFilterModal">Филтри</button><button class="button secondary" type="button" @click="toggleTrashMode" x-text="trashMode ? 'Всички страници' : 'Кошче'"></button><button class="button primary" type="button" @click="startCreate" x-show="!trashMode">Нова страница</button></div></div><div class="notice error" x-show="error" x-text="error"></div><div class="pages-table">${dataTableMarkup("filteredPageRows()", [{ key: "title", label: "Име", sortable: true, linkTemplate: "/admin/pages/{id}/edit" }, { key: "slug", label: "Slug", sortable: true }, { key: "status", label: "Статус", sortable: true }, { key: "updated_at", label: "Дата на обновяване", sortable: true }], actionDropdownMarkup('<button class="dropdown-option" type="button" x-show="!trashMode" @click="startEdit(row)">Редактирай</button><button class="dropdown-option" type="button" x-show="!trashMode" @click="startSettings(row)">Настройки</button><button class="dropdown-option" type="button" x-show="!trashMode" @click="openPageModal(\'trash\', row)">Премести в кошчето</button><button class="dropdown-option" type="button" x-show="trashMode" @click="openPageModal(\'restore\', row)">Възстанови</button><button class="dropdown-option" type="button" x-show="trashMode" @click="openPageModal(\'force\', row)">Изтрий завинаги</button>'), true)}</div></section></template>
          <template x-if="page === 'pages-create' || page === 'pages-edit'"><section><div class="page-heading-row"><div>${breadcrumbsMarkup("page === 'pages-edit' ? 'Редактиране на страница' : 'Създаване на страница'", [{ label: "Страници", href: "/admin/pages" }])}<h1 x-text="page === 'pages-edit' ? 'Редактиране на страница' : 'Създаване на страница'"></h1>${collapsibleTextMarkup("В този формуляр създавате или редактирате страница от сайта. Въведете заглавие — системата ще генерира автоматично slug адреса, докато не го промените ръчно. Изберете родителска страница, ако страницата трябва да бъде част от йерархия. Добавете съдържание чрез текстовия редактор, изберете статус и запазете промените. Невалидните полета ще бъдат маркирани с конкретно съобщение.")}</div><div class="page-heading-actions"><button class="button primary" type="button" @click="startSettings" x-show="page === 'pages-edit'">Настройки</button><button class="button primary" type="button" @click="startCreate" x-show="page === 'pages-edit'">Нова страница</button></div></div><div class="notice error" x-show="error" x-text="error"></div><form class="page-form" @submit.prevent="savePage"><p class="form-required-note"><span class="required-marker" aria-hidden="true">*</span> Задължителни полета</p><label>Заглавие<input data-slot="input" type="text" x-model="form.title" maxlength="190" @input="if (!slugManuallyEdited) form.slug = slugify(form.title)" required aria-required="true" :aria-invalid="fieldErrors.title ? true : undefined"><span class="field-error" x-show="fieldErrors.title" x-text="fieldErrors.title"></span></label><label>URL адрес (slug)<input data-slot="input" type="text" x-model="form.slug" maxlength="190" @input="slugManuallyEdited = true" required aria-required="true" :aria-invalid="fieldErrors.slug ? true : undefined"><span class="field-error" x-show="fieldErrors.slug" x-text="fieldErrors.slug"></span></label>${richTextEditorMarkup("form.content", "Съдържание")}${contentBlocksMarkup()}${parentDropdownMarkup()}<label><span class="field-label">Статус<span class="required-marker" aria-hidden="true">*</span></span><select data-slot="select-trigger" x-model="form.status" required aria-required="true"><option value="draft">Чернова</option><option value="published">Публикувана</option></select><span class="field-error" x-show="fieldErrors.status" x-text="fieldErrors.status"></span></label><div class="page-form-actions"><button class="button primary" type="submit" :disabled="saving" x-text="saving ? 'Записване…' : 'Запази страницата'"></button><button class="button secondary" type="button" @click="navigate('/admin/pages')">Отказ</button></div></form></section></template>
          <template x-if="page === 'pages-settings'"><section><div class="page-heading-row"><div>${breadcrumbsMarkup("'Настройки на страница'", [{ label: "Страници", href: "/admin/pages" }])}<h1>Настройки на страница</h1><p class="page-settings-subject">Настройки за: <strong x-text="form.title || 'страницата'"></strong></p>${collapsibleTextMarkup("Тук управлявате основните, SEO и навигационните настройки на страницата. Шаблонът определя начина на визуализация, позицията контролира реда в навигацията, а sitemap настройката управлява участието на страницата в картата на сайта.")}</div></div><div class="notice error" x-show="error" x-text="error"></div><form class="page-form" @submit.prevent="savePageSettings"><div class="settings-grid"><label><span class="field-label">Шаблон на страницата</span><select data-slot="select-trigger" x-model="pageSettings.template"><option value="default">Стандартен</option><option value="full_width">Пълна ширина</option><option value="landing">Landing page</option></select></label><label><span class="field-label">Позиция в навигацията</span><input class="form-control" type="number" min="0" step="1" x-model.number="pageSettings.menu_order"><span class="field-hint-text">По-малките числа се показват по-напред.</span></label></div><label class="checkbox-field"><input type="checkbox" x-model="pageSettings.use_parent_slugs"><span>Използвай slug-овете на родителските страници в URL адреса</span></label><label><span class="field-label">SEO заглавие</span><input class="form-control" type="text" x-model="pageSettings.seo_title" maxlength="190"></label><label><span class="field-label">Meta описание</span><textarea class="form-control" x-model="pageSettings.meta_description" maxlength="320" rows="4"></textarea></label><label><span class="field-label">Canonical URL</span><input class="form-control" type="url" x-model="pageSettings.canonical_url" placeholder="https://example.com/page"></label><label class="checkbox-field"><input type="checkbox" x-model="pageSettings.no_index"><span>Не показвай страницата в резултатите от търсачки</span></label><label class="checkbox-field"><input type="checkbox" x-model="pageSettings.show_in_navigation"><span>Показвай страницата в навигацията</span></label><label class="checkbox-field"><input type="checkbox" x-model="pageSettings.show_in_sitemap"><span>Включи страницата в sitemap-а</span></label><div class="page-form-actions"><button class="button primary" type="submit" :disabled="saving" x-text="saving ? 'Записване…' : 'Запази настройките'"></button><button class="button secondary" type="button" @click="navigate('/admin/pages/' + editingId + '/edit')">Назад към редакцията</button></div></form></section></template>
          <template x-if="page === 'updates'"><section>${breadcrumbsMarkup("'Обновявания'")}<h1>Обновявания</h1><p class="lead">Качете ZIP пакет за версията и стартирайте контролирано обновяване.</p><div class="notice success" x-show="notice" x-text="notice"></div><div class="notice error" x-show="error" x-text="error"></div><section class="content-card"><header>${sectionHeader("Качване на platform пакет", "updates-upload")}</header><div class="section-body" x-show="!isSectionCollapsed('updates-upload')"><form method="post" action="/admin/updates/install" enctype="multipart/form-data"><input type="hidden" name="_token" :value="csrfToken"><input type="hidden" name="mode" value="install"><label>ZIP пакет на новата версия<input type="file" name="package" accept="application/zip,.zip" required></label><button class="button primary" type="submit">Актуализирай платформата</button></form><p class="muted">Системата проверява checksum, цифровия подпис и съвместимостта, създава backup, изпълнява миграциите и прави health check.</p></div></section><section class="content-card"><header>${sectionHeader("История", "updates-history")}</header><div class="section-body" x-show="!isSectionCollapsed('updates-history')"><div class="table-wrapper"><table><thead><tr><th>Тип</th><th>ID</th><th>От</th><th>До</th><th>Дата</th><th>Действия</th></tr></thead><tbody><template x-for="item in history" :key="item.id"><tr><td x-text="item.type"></td><td x-text="item.id"></td><td x-text="item.from"></td><td x-text="item.to"></td><td x-text="item.installed_at || item.rolled_back_at"></td><td><form method="post" action="/admin/updates/rollback"><input type="hidden" name="_token" :value="csrfToken"><input type="hidden" name="id" :value="item.id"><button class="button secondary" type="submit">Rollback</button></form></td></tr></template></tbody></table></div></div></section></section></template>
        </main>
      </div>
      ${confirmModalMarkup()}${filterModalMarkup(dropdownMarkup("draftPageFilters.status", [{ value: "all", label: "Всички статуси" }, { value: "draft", label: "Чернови" }, { value: "published", label: "Публикувани" }]), dropdownMarkup("draftPageFilters.structure", [{ value: "all", label: "Всички страници" }, { value: "root", label: "Родителски страници" }, { value: "child", label: "Дъщерни страници" }]), dropdownMarkup("draftPageFilters.view", [{ value: "active", label: "Активни страници" }, { value: "trash", label: "Кошче" }]))}${bulkActionModalMarkup(dropdownMarkup("bulkModal.action", [{ value: "trash", label: "Премести в кошчето" }, { value: "force", label: "Изтрий завинаги" }, { value: "settings", label: "Редактиране на настройки" }]))}<div class="admin-system-footer"><span>Flex CMS</span><strong>v${escapeHtml(readBootstrap()?.version ?? "")}</strong></div>
    </div>`

  const withAdminExtensions = markup
    .replace("</ul></nav>", `${adminSidebarMarkup()}</ul></nav>`)
    .replace('<h1>Административен панел', `${adminSlotMarkup("admin.dashboard.before")}<h1>Административен панел`)
    .replace('<p class="lead">Имате пълен достъп до системната администрация като супер администратор.</p>', `<p class="lead">Имате пълен достъп до системната администрация като супер администратор.</p>${adminSlotMarkup("admin.dashboard.after")}`)
    .replace('<h1>Профил</h1>', `${adminSlotMarkup("admin.profile.before")}<h1>Профил</h1>`)
    .replace('<p class="lead">Основни данни за текущия потребител.</p>', `<p class="lead">Основни данни за текущия потребител.</p>${adminSlotMarkup("admin.profile.after")}`)
    .replace('<div class="pages-table">', `${adminSlotMarkup("admin.pages.table.before")}<div class="pages-table">`)
    .replace('<form class="page-form"', `${adminSlotMarkup("admin.page.form.before")}<form class="page-form"`)
    .replace('<div class="page-form-actions">', `${adminSlotMarkup("admin.page.form.after")}<div class="page-form-actions">`)
    .replace('<section class="content-card"><header>${sectionHeader("Качване на platform пакет", "updates-upload")}', `${adminSlotMarkup("admin.updates.before")}<section class="content-card"><header>${sectionHeader("Качване на platform пакет", "updates-upload")}`)
    .replace('<section class="content-card"><header>${sectionHeader("История", "updates-history")}', `<section class="content-card"><header>${sectionHeader("История", "updates-history")}${adminSlotMarkup("admin.updates.after")}`)
    .replace('<div class="notice error" x-show="error" x-text="error"></div><div class="pages-table table-wrapper">', `${adminSlotMarkup("admin.plugins.before")}<div class="notice error" x-show="error" x-text="error"></div><div class="pages-table table-wrapper">${adminSlotMarkup("admin.plugins.after")}`)

  const withDropdowns = withAdminExtensions
    .replace(/<select x-model="theme" @change="saveTheme">.*?<\/select>/, dropdownMarkup("theme", [{ value: "system", label: "Системна" }, { value: "light", label: "Светла" }, { value: "dark", label: "Тъмна" }], "saveTheme()"))
    .replace(/<select data-slot="select-trigger" x-model="form.status"[^>]*>.*?<\/select>/, dropdownMarkup("form.status", [{ value: "draft", label: "Чернова" }, { value: "published", label: "Публикувана" }]))
    .replace(/<select data-slot="select-trigger" x-model="pageSettings.template"[^>]*>.*?<\/select>/, dropdownMarkup("pageSettings.template", [{ value: "default", label: "Стандартен" }, { value: "full_width", label: "Пълна ширина" }, { value: "landing", label: "Landing page" }], undefined, '<span class="field-hint-text">Определя основната структура и визуализация на страницата.</span>'))

  const withControls = withDropdowns
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

  return withHints.replace(/ x-show="!isSectionCollapsed\('([^']+)'\)"/g, ` x-show="!isSectionCollapsed('$1')" x-transition:enter="section-transition" x-transition:enter-start="section-transition-start" x-transition:enter-end="section-transition-end" x-transition:leave="section-transition" x-transition:leave-start="section-transition-end" x-transition:leave-end="section-transition-start"`)
}

function alignBreadcrumbsBelowDescription(): void {
  root?.querySelectorAll<HTMLElement>(".breadcrumbs").forEach((breadcrumbs) => {
    const section = breadcrumbs.closest("section")
    const description = section?.querySelector<HTMLElement>(".collapsible-text")
    const lead = section?.querySelector<HTMLElement>(":scope > .lead")
    const anchor = description ?? lead

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
  const state = {
    page: initial.page, pageTitle: "", csrfToken: initial.csrfToken, version: initial.version,
    width: initial.sidebarWidth, collapsed: initial.sidebarCollapsed ?? false, mobileOpen: false, isMobile: false, loading: false,
    user: initial.user ?? { name: "", email: "", role: "", status: "" }, theme: localStorage.getItem("flexcms.admin.theme") ?? "system",
    pages: initial.pages ?? [], trashedPages: initial.trashedPages ?? [], plugins: initial.plugins ?? [], pluginDetail: initial.pluginDetail ?? null, pluginPermissionDraft: initial.pluginDetail?.approved_permissions ?? [] as string[], adminExtensions: initial.adminExtensions ?? { sidebar: [], slots: {} }, pluginBusy: "", trashMode: pageFilters.view === "trash", pageFilters, draftPageFilters: { ...pageFilters }, filterModalOpen: false, history: initial.history ?? [], notice: initial.notice ?? "", error: initial.error ?? "", inspection: initial.inspection, collapsedSections: initial.collapsedSections ?? {},
    pageModal: { open: false, action: "trash" as "trash" | "restore" | "force", title: "", message: "", confirmLabel: "", page: null as PageRecord | null, busy: false },
    selectedPageIds: [] as number[], bulkModal: { open: false, action: "trash" as "trash" | "force" | "settings", busy: false, settings: { use_parent_slugs: false, no_index: false, show_in_navigation: true, show_in_sitemap: true } },
    editingId: null as number | null, saving: false, slugManuallyEdited: false, fieldErrors: {} as FieldErrors,
    form: { title: "", slug: "", content: "", blocks: [] as ContentBlock[], parentId: "" as string | number, status: "draft" as "draft" | "published" }, pageSettings: { seo_title: "", meta_description: "", canonical_url: "", template: "default", menu_order: 0, use_parent_slugs: false, no_index: false, show_in_navigation: true, show_in_sitemap: true } as PageSettings,
    init() { this.syncMedia(); window.addEventListener("resize", () => this.syncMedia()); this.saveTheme(); setTimeout(() => this.syncCollapsedSections(), 0) },
    syncMedia() { this.isMobile = window.matchMedia("(max-width: 48rem)").matches; if (!this.isMobile) this.mobileOpen = false },
    toggleSidebar() { if (this.isMobile) { this.mobileOpen = !this.mobileOpen } else { this.collapsed = !this.collapsed; $.ajax({ url: "/admin/sidebar-width", method: "POST", data: { _token: this.csrfToken, collapsed: this.collapsed ? "1" : "0" }, headers: { "X-CSRF-Token": this.csrfToken } }) } },
    toggleSection(key: string, element: HTMLElement) { this.collapsedSections[key] = !this.collapsedSections[key]; element.closest(".content-card")?.classList.toggle("is-collapsed", this.collapsedSections[key]); $.ajax({ url: "/admin/section-state", method: "POST", data: { _token: this.csrfToken, key, collapsed: this.collapsedSections[key] ? "1" : "0" }, headers: { "X-CSRF-Token": this.csrfToken } }) },
    isSectionCollapsed(key: string) { return this.collapsedSections[key] === true },
    syncCollapsedSections() { document.querySelectorAll<HTMLElement>(".section-header[data-section-key]").forEach((header) => { header.closest(".content-card")?.classList.toggle("is-collapsed", this.isSectionCollapsed(header.dataset.sectionKey ?? "")) }) },
    navigate(url: string, pushHistory = true) { this.loading = true; $.get(url, (markup: string) => { const next = new DOMParser().parseFromString(markup, "text/html").getElementById("flex-admin-bootstrap"); if (!next) return; this.applyBootstrap(JSON.parse(next.textContent ?? "{}") as Bootstrap); if (pushHistory) window.history.pushState({}, "", url); window.scrollTo({ top: 0, behavior: "smooth" }) }, "html").fail(() => { this.error = "Страницата не можа да бъде заредена."; showToast(this.error, "error") }).always(() => { this.loading = false }) },
    pluginAction(action: "install" | "activate" | "deactivate" | "uninstall", plugin: PluginRecord) { if (action === "uninstall" && !window.confirm(`Сигурни ли сте, че искате да премахнете „${plugin.name}“? Това действие изтрива файловете на плъгина.`)) return; this.pluginBusy = plugin.id; $.ajax({ url: "/api/plugins/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ id: plugin.id, action }) }).done(() => { showToast(action === "install" ? "Плъгинът е инсталиран." : action === "activate" ? "Плъгинът е активиран." : action === "deactivate" ? "Плъгинът е деактивиран." : "Плъгинът е премахнат.", "success"); this.navigate("/admin/plugins") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Операцията с плъгина не беше изпълнена."; this.error = message; showToast(message, "error") }).always(() => { this.pluginBusy = "" }) },
    approvePluginPermissions() { if (!this.pluginDetail) return; $.ajax({ url: "/api/plugins/action", method: "POST", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify({ id: this.pluginDetail.id, action: "approve_permissions", permissions: this.pluginPermissionDraft }) }).done((response: { plugin?: PluginRecord }) => { if (response.plugin) { this.pluginDetail = response.plugin; this.plugins = this.plugins.map((plugin: PluginRecord) => plugin.id === response.plugin?.id ? response.plugin : plugin) } showToast("Разрешенията са запазени.", "success") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Разрешенията не можаха да бъдат запазени."; this.error = message; showToast(message, "error") }) },
    slugify(value: string) { return slugifyPageTitle(value) },
    saveTheme() { localStorage.setItem("flexcms.admin.theme", this.theme); document.documentElement.classList.remove("light", "dark"); document.documentElement.classList.add(this.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : this.theme) },
    startCreate() { this.navigate("/admin/pages/create") },
    startEdit(item: PageRecord) { this.navigate(`/admin/pages/${item.id}/edit`) },
    startSettings(item?: PageRecord) { const id = item?.id ?? this.editingId; if (id) this.navigate(`/admin/pages/${id}/settings`) },
    addContentBlock(type: ContentBlock["type"]) { this.form.blocks.push({ type, data: {} }) },
    removeContentBlock(index: number) { this.form.blocks.splice(index, 1) },
    toggleTrashMode() { this.selectedPageIds = []; this.trashMode = !this.trashMode; this.pageFilters = { ...this.pageFilters, view: this.trashMode ? "trash" : "active" }; writePageFiltersToUrl(this.pageFilters) },
    filteredPageRows() { const rows = this.trashMode ? this.trashedPages : this.pages; return rows.filter((row) => { const statusMatches = this.pageFilters.status === "all" || row.status === this.pageFilters.status; const structureMatches = this.pageFilters.structure === "all" || (this.pageFilters.structure === "root" && !row.parent_id) || (this.pageFilters.structure === "child" && Boolean(row.parent_id)); return statusMatches && structureMatches }) },
    toggleRowSelection(id: number) { this.selectedPageIds = this.selectedPageIds.includes(id) ? this.selectedPageIds.filter((item) => item !== id) : [...this.selectedPageIds, id] },
    allVisibleRowsSelected() { const rows = this.filteredPageRows(); return rows.length > 0 && rows.every((row) => this.selectedPageIds.includes(row.id)) },
    toggleAllVisibleRows(checked: boolean) { const visibleIds = this.filteredPageRows().map((row) => row.id); this.selectedPageIds = checked ? [...new Set([...this.selectedPageIds, ...visibleIds])] : this.selectedPageIds.filter((id) => !visibleIds.includes(id)) },
    openBulkModal() { if (this.selectedPageIds.length === 0) return; this.bulkModal = { open: true, action: this.trashMode ? "force" : "trash", busy: false, settings: { use_parent_slugs: false, no_index: false, show_in_navigation: true, show_in_sitemap: true } } },
    closeBulkModal() { if (!this.bulkModal.busy) this.bulkModal.open = false },
    applyBulkAction() { const ids = [...this.selectedPageIds]; if (!ids.length) return; this.bulkModal.busy = true; const action = this.bulkModal.action; const settings = { ...this.bulkModal.settings }; const run = (index: number): void => { if (index >= ids.length) { this.bulkModal.open = false; this.selectedPageIds = []; this.bulkModal.busy = false; showToast("Масовото действие е изпълнено.", "success"); this.navigate("/admin/pages"); return } const id = ids[index]; const url = action === "trash" ? `/api/pages/${id}` : action === "force" ? `/api/pages/${id}/force` : `/api/pages/${id}/settings`; const request: JQuery.AjaxSettings = { url, method: action === "settings" ? "PATCH" : "DELETE", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken } }; if (action === "settings") { request.contentType = "application/json"; request.data = JSON.stringify(settings) } $.ajax(request).done(() => run(index + 1)).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Масовото действие не беше изпълнено."; this.error = message; this.bulkModal.busy = false; showToast(message, "error") }) }; run(0) },
    openFilterModal() { this.draftPageFilters = { ...this.pageFilters }; this.filterModalOpen = true },
    closeFilterModal() { this.filterModalOpen = false },
    applyPageFilters() { this.pageFilters = { ...this.draftPageFilters }; this.trashMode = this.pageFilters.view === "trash"; writePageFiltersToUrl(this.pageFilters); this.filterModalOpen = false },
    resetPageFilters() { this.draftPageFilters = { status: "all", structure: "all", view: "active" } },
    openPageModal(action: "trash" | "restore" | "force", page: PageRecord) { const restore = action === "restore"; this.pageModal = { open: true, action, page, busy: false, title: restore ? "Възстановяване на страница" : action === "trash" ? "Преместване в кошчето" : "Окончателно изтриване", message: restore ? `Сигурни ли сте, че искате да възстановите „${page.title}“?` : action === "trash" ? `Сигурни ли сте, че искате да преместите „${page.title}“ в кошчето?` : `Сигурни ли сте, че искате да изтриете завинаги „${page.title}“? Това действие не може да бъде отменено.`, confirmLabel: restore ? "Възстанови" : action === "trash" ? "Премести в кошчето" : "Изтрий завинаги" } },
    closePageModal() { if (!this.pageModal.busy) this.pageModal.open = false },
    confirmPageAction() { const page = this.pageModal.page; if (!page) return; this.pageModal.busy = true; const restore = this.pageModal.action === "restore"; const url = restore ? `/api/pages/${page.id}/restore` : this.pageModal.action === "trash" ? `/api/pages/${page.id}` : `/api/pages/${page.id}/force`; const method = restore ? "POST" : "DELETE"; $.ajax({ url, method, dataType: "json", headers: { "X-CSRF-Token": this.csrfToken } }).done(() => { showToast(restore ? "Страницата е възстановена." : this.pageModal.action === "trash" ? "Страницата е преместена в кошчето." : "Страницата е изтрита завинаги.", "success"); this.pageModal.open = false; this.navigate("/admin/pages") }).fail((xhr: JQuery.jqXHR) => { const message = xhr.responseJSON?.error?.message ?? "Операцията не беше изпълнена."; this.error = message; showToast(message, "error") }).always(() => { this.pageModal.busy = false }) },
    savePage() { const payload = { ...this.form, parent_id: this.form.parentId === "" ? null : Number(this.form.parentId) }; const parsed = pageFormSchema.safeParse(payload); if (!parsed.success) { this.fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])) as FieldErrors; this.error = "Моля, поправете маркираните полета."; showToast(this.error, "error"); return } this.saving = true; const creating = this.editingId === null; $.ajax({ url: creating ? "/api/pages" : `/api/pages/${this.editingId}`, method: creating ? "POST" : "PATCH", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify(parsed.data) }).done((response: { page?: PageRecord }) => { showToast(creating ? "Страницата е създадена." : "Страницата е обновена.", "success"); if (creating && response.page?.id) this.navigate(`/admin/pages/${response.page.id}/edit`) }).fail((xhr: JQuery.jqXHR) => { const details = (xhr.responseJSON?.error?.details?.fields ?? {}) as Record<string, string[]>; this.fieldErrors = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value[0]])) as FieldErrors; this.error = xhr.responseJSON?.error?.message ?? "Неуспешно записване на страницата."; showToast(this.error, "error") }).always(() => { this.saving = false }) },
    savePageSettings() { if (!this.editingId) return; this.saving = true; $.ajax({ url: `/api/pages/${this.editingId}/settings`, method: "PATCH", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify(this.pageSettings) }).done((response: { page?: PageRecord }) => { if (response.page?.settings) this.pageSettings = response.page.settings; showToast("Настройките са запазени.", "success") }).fail((xhr: JQuery.jqXHR) => { this.error = xhr.responseJSON?.error?.message ?? "Настройките не можаха да бъдат запазени."; showToast(this.error, "error") }).always(() => { this.saving = false }) },
    applyBootstrap(next: Bootstrap) { this.page = next.page; this.pageTitle = ({ dashboard: "Табло", updates: "Обновявания", pages: "Страници", "pages-create": "Създаване на страница", "pages-edit": "Редактиране на страница", "pages-settings": "Настройки на страница", profile: "Профил", plugins: "Разширения", "plugin-detail": "Детайли на разширение" } as Record<string, string>)[next.page]; this.csrfToken = next.csrfToken; this.width = next.sidebarWidth; this.collapsed = next.sidebarCollapsed ?? false; this.collapsedSections = next.collapsedSections ?? {}; this.pages = next.pages ?? this.pages; this.trashedPages = next.trashedPages ?? this.trashedPages; this.plugins = next.plugins ?? this.plugins; this.pluginDetail = next.pluginDetail ?? null; this.pluginPermissionDraft = next.pluginDetail?.approved_permissions ?? []; this.selectedPageIds = []; this.bulkModal.open = false; if (next.page === "pages") { this.pageFilters = readPageFiltersFromUrl(); this.draftPageFilters = { ...this.pageFilters }; this.trashMode = this.pageFilters.view === "trash" } this.history = next.history ?? []; this.notice = next.notice ?? ""; this.error = next.error ?? ""; this.inspection = next.inspection; const pageData = next.pageData ?? null; this.editingId = pageData?.id ?? null; this.form = pageData ? { title: pageData.title, slug: pageData.slug, content: pageData.content, blocks: pageData.blocks ?? [], parentId: pageData.parent_id ?? "", status: pageData.status } : { title: "", slug: "", content: "", blocks: [], parentId: "", status: "draft" }; this.pageSettings = pageData?.settings ? { ...this.pageSettings, ...pageData.settings } : { seo_title: "", meta_description: "", canonical_url: "", template: "default", menu_order: 0, use_parent_slugs: false, no_index: false, show_in_navigation: true, show_in_sitemap: true }; this.slugManuallyEdited = false; this.fieldErrors = {}; this.mobileOpen = false; setTimeout(() => this.syncCollapsedSections(), 0) },
  }
  const initialPageData = initial.pageData ?? null
  state.editingId = initialPageData?.id ?? null
  state.form = initialPageData ? { title: initialPageData.title, slug: initialPageData.slug, content: initialPageData.content, blocks: initialPageData.blocks ?? [], parentId: initialPageData.parent_id ?? "", status: initialPageData.status } : state.form
  state.pageSettings = initialPageData?.settings ? { ...state.pageSettings, ...initialPageData.settings } : state.pageSettings
  state.pluginDetail = initial.pluginDetail ?? null
  state.adminExtensions = initial.adminExtensions ?? { sidebar: [], slots: {} }
  state.pluginPermissionDraft = initial.pluginDetail?.approved_permissions ?? []
  state.pageTitle = ({ dashboard: "Табло", updates: "Обновявания", pages: "Страници", "pages-create": "Създаване на страница", "pages-edit": "Редактиране на страница", "pages-settings": "Настройки на страница", profile: "Профил", plugins: "Разширения", "plugin-detail": "Детайли на разширение" } as Record<string, string>)[initial.page]
  return state
}

const initial = readBootstrap()
Alpine.data("loginForm", () => ({ submitting: false }))
registerRichTextEditor(Alpine)
registerDataTable(Alpine)
if (root && initial) {
  const adminState = createAdminState(initial)
  Alpine.data("adminApp", () => adminState)
  root.innerHTML = adminMarkup()
  window.addEventListener("popstate", () => { adminState.navigate(window.location.href, false) })
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
