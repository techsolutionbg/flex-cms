import Alpine from "alpinejs"
import $ from "jquery"
import "@fontsource-variable/geist"

import { actionDropdownMarkup, dataTableMarkup, registerDataTable } from "@/components/data-table"
import { breadcrumbsMarkup } from "@/components/breadcrumbs"
import { collapsibleTextMarkup } from "@/components/collapsible-text"
import { fieldHintMarkup } from "@/components/field-hint"
import { registerRichTextEditor, richTextEditorMarkup } from "@/components/rich-text-editor"
import { showToast } from "@/components/toast"
import { pageFormSchema, slugifyPageTitle } from "@/lib/page-validation"
import "@/styles/globals.css"

type PageRecord = {
  id: number
  title: string
  slug: string
  content: string
  status: "draft" | "published"
  published_at: string | null
  created_at: string | null
  updated_at: string | null
  parent_id?: number | null
  depth?: number
}

type Bootstrap = {
  page: "dashboard" | "updates" | "profile" | "pages" | "pages-create" | "pages-edit"
  csrfToken: string
  sidebarWidth: number
  sidebarCollapsed?: boolean
  collapsedSections?: Record<string, boolean>
  version: string
  user?: { name: string; email: string; role: string; status: string }
  pages?: PageRecord[]
  pageData?: PageRecord | null
  history?: Array<Record<string, string | boolean | undefined>>
  notice?: string | null
  error?: string | null
  inspection?: { version?: string; files?: number; migrations?: boolean } | null
}

type FieldErrors = Partial<Record<"title" | "slug" | "parent_id" | "status", string>>

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

function sectionHeader(title: string, key: string, expression?: string): string {
  const titleAttributes = expression ? ` x-text="${expression}"` : ""
  return `<button class="section-header" data-section-key="${key}" type="button" @click="toggleSection('${key}', $el)" :aria-expanded="!isSectionCollapsed('${key}')"><span${titleAttributes}>${title}</span><svg class="section-chevron" :class="{ 'is-collapsed': isSectionCollapsed('${key}') }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button>`
}

function dropdownMarkup(model: string, options: Array<{ value: string; label: string }>, onChange?: string): string {
  const optionMap = Object.fromEntries(options.map((option) => [option.value, option.label]))
  const changeAction = onChange ? `; ${onChange}` : ""
  const optionMarkup = options.map((option) => `<button class="dropdown-option" type="button" @click="value = '${option.value}'; open = false${changeAction}" :class="{ 'is-selected': value === '${option.value}' }">${option.label}</button>`).join("")

  return `<div class="custom-dropdown" x-data="{ open: false, value: null, menuStyle: '', placement: 'bottom', reposition() { const rect = $refs.trigger.getBoundingClientRect(); const desired = Math.min(256, ${options.length} * 48 + 8); const below = window.innerHeight - rect.bottom - 8; const above = rect.top - 8; const opensAbove = below < desired && above > below; const available = Math.max(96, opensAbove ? above : below); const height = Math.min(desired, available); this.placement = opensAbove ? 'top' : 'bottom'; this.menuStyle = \`left: \${rect.left}px; top: \${opensAbove ? rect.top - height - 8 : rect.bottom + 8}px; width: \${rect.width}px; max-height: \${height}px;\`; } }" x-modelable="value" x-model="${model}" @click.outside="open = false" @keydown.escape.window="open = false" @resize.window="if (open) reposition()" @scroll.window="if (open) reposition()"><button x-ref="trigger" class="form-control dropdown-trigger" type="button" data-slot="select-trigger" @click="open = !open; if (open) $nextTick(() => reposition())" :aria-expanded="open"><span x-text="${JSON.stringify(optionMap)}[value] ?? ''"></span><svg class="dropdown-chevron" :class="{ 'is-open': open }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button><template x-teleport="body"><div class="dropdown-menu" @click.stop :data-placement="placement" :style="menuStyle" x-show="open" x-transition:enter="dropdown-transition" x-transition:enter-start="dropdown-transition-start" x-transition:enter-end="dropdown-transition-end" x-transition:leave="dropdown-transition" x-transition:leave-start="dropdown-transition-end" x-transition:leave-end="dropdown-transition-start">${optionMarkup}</div></template></div>`
}

function parentDropdownMarkup(): string {
  return `<label><span class="field-label">Родителска страница${fieldHintMarkup("Изберете родителска страница, ако тази страница трябва да бъде подчинена на друга.")}</span><div class="custom-dropdown" x-data="{ open: false, value: null, menuStyle: '', reposition() { const rect = $refs.trigger.getBoundingClientRect(); const desired = 256; const below = window.innerHeight - rect.bottom - 8; const above = rect.top - 8; const opensAbove = below < desired && above > below; const available = Math.max(96, opensAbove ? above : below); const height = Math.min(desired, available); this.placement = opensAbove ? 'top' : 'bottom'; this.menuStyle = \`left: \${rect.left}px; top: \${opensAbove ? rect.top - height - 8 : rect.bottom + 8}px; width: \${rect.width}px; max-height: \${height}px;\`; }, placement: 'bottom' }" x-modelable="value" x-model="form.parentId" @click.outside="open = false" @keydown.escape.window="open = false" @resize.window="if (open) reposition()" @scroll.window="if (open) reposition()"><button x-ref="trigger" class="form-control dropdown-trigger" type="button" data-slot="select-trigger" @click="open = !open; if (open) $nextTick(() => reposition())" :aria-expanded="open"><span x-text="value ? (pages.find((option) => String(option.id) === String(value)) ? ('— '.repeat(pages.find((option) => String(option.id) === String(value)).depth ?? 0) + pages.find((option) => String(option.id) === String(value)).title) : '') : 'Няма родителска страница'"></span><svg class="dropdown-chevron" :class="{ 'is-open': open }" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></button><template x-teleport="body"><div class="dropdown-menu" @click.stop :data-placement="placement" :style="menuStyle" x-show="open" x-transition:enter="dropdown-transition" x-transition:enter-start="dropdown-transition-start" x-transition:enter-end="dropdown-transition-end" x-transition:leave="dropdown-transition" x-transition:leave-start="dropdown-transition-end" x-transition:leave-end="dropdown-transition-start"><button class="dropdown-option" type="button" @click="value = ''; open = false">Няма родителска страница</button><template x-for="option in pages" :key="option.id"><button class="dropdown-option" type="button" x-show="option.id !== editingId" @click="value = option.id; open = false" :class="{ 'is-selected': String(value) === String(option.id) }" x-text="'— '.repeat(option.depth ?? 0) + option.title"></button></template></div></template></div><span class="field-error" x-show="fieldErrors.parent_id" x-text="fieldErrors.parent_id"></span></label>`
}

function adminMarkup(): string {
  const markup = `
    <div class="admin-shell sidebar-enhanced" x-data="adminApp" :class="{ 'sidebar-collapsed': collapsed, 'sidebar-mobile-open': mobileOpen }" :style="\`--sidebar-width: \${width}px\`">
      <aside id="admin-sidebar" class="admin-sidebar" :aria-hidden="isMobile && !mobileOpen">
        <div class="sidebar-brand"><img class="sidebar-logo" src="/assets/brand/logo.png" alt="Flex CMS"></div>
        <nav aria-label="Административна навигация"><ul class="sidebar-nav-list">
          <li><a class="sidebar-link" href="/admin" @click.prevent="navigate('/admin')" :class="{ 'is-active': page === 'dashboard' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-8Z" /></svg><span class="sidebar-link-label">Табло</span></a></li>
          <li><a class="sidebar-link" href="/admin/updates" @click.prevent="navigate('/admin/updates')" :class="{ 'is-active': page === 'updates' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.8-4M4 5v4h4M4 13a8 8 0 0 0 14.8 4M20 19v-4h-4" /></svg><span class="sidebar-link-label">Обновявания</span></a></li>
          <li><a class="sidebar-link" href="/admin/pages" @click.prevent="navigate('/admin/pages')" :class="{ 'is-active': page === 'pages' || page === 'pages-create' || page === 'pages-edit' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l3 3v15H6V3Zm9 0v4h3M9 12h6M9 16h6M9 8h2" /></svg><span class="sidebar-link-label">Страници</span></a></li>
          <li><a class="sidebar-link" href="/admin/profile" @click.prevent="navigate('/admin/profile')" :class="{ 'is-active': page === 'profile' }"><svg class="sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg><span class="sidebar-link-label">Профил</span></a></li>
        </ul></nav>
      </aside>
      <button class="sidebar-backdrop" type="button" aria-label="Затвори страничната лента" x-show="mobileOpen" @click="mobileOpen = false"></button>
      <div class="admin-main">
        <header class="admin-topbar"><button class="sidebar-toggle" type="button" aria-label="Покажи или прибери страничната лента" @click="toggleSidebar" :aria-expanded="!collapsed || mobileOpen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button><div class="topbar-title" x-text="pageTitle"></div><div class="topbar-actions"><form method="post" action="/logout"><input type="hidden" name="_token" :value="csrfToken"><button class="logout" type="submit">Изход</button></form></div></header>
        <main class="admin-content">
          <template x-if="page === 'dashboard'"><section>${breadcrumbsMarkup("'Табло'", [], "page === 'dashboard'")}<h1>Административен панел</h1><p class="lead">Имате пълен достъп до системната администрация като супер администратор.</p><section class="dashboard-grid"><article class="content-card"><header>${sectionHeader("Потребители", "dashboard-users")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-users')"><p>Управление на потребители, роли и статуси.</p><a href="/api/users">Отвори API →</a></div></article><article class="content-card"><header>${sectionHeader("Обновявания", "dashboard-updates")}</header><div class="section-body" x-show="!isSectionCollapsed('dashboard-updates')"><p>Проверка, инсталация и връщане на подписани platform пакети.</p><a href="/admin/updates" @click.prevent="navigate('/admin/updates')">Отвори обновявания →</a></div></article></section></section></template>
          <template x-if="page === 'profile'"><section>${breadcrumbsMarkup("'Профил'")}<h1>Профил</h1><p class="lead">Основни данни за текущия потребител.</p><section class="content-card profile-card"><header>${sectionHeader("Данни на потребителя", "profile-details")}</header><div class="section-body" x-show="!isSectionCollapsed('profile-details')"><dl class="profile-details"><div><dt>Име</dt><dd x-text="user.name"></dd></div><div><dt>Имейл</dt><dd x-text="user.email"></dd></div><div><dt>Роля</dt><dd x-text="user.role"></dd></div><div><dt>Статус</dt><dd x-text="user.status"></dd></div></dl></div></section><section class="content-card profile-card"><header>${sectionHeader("Настройки на темата", "profile-theme")}</header><div class="section-body" x-show="!isSectionCollapsed('profile-theme')"><label class="profile-setting"><span class="field-label">Тема на приложението${fieldHintMarkup("Изберете светла, тъмна или системна тема. При системна тема се използва настройката на операционната система.")}</span><select x-model="theme" @change="saveTheme"><option value="system">Системна</option><option value="light">Светла</option><option value="dark">Тъмна</option></select></label></div></section></section></template>
          <template x-if="page === 'pages'"><section>${breadcrumbsMarkup("'Страници'")}<div class="page-heading-row pages-heading"><div><h1>Страници</h1>${collapsibleTextMarkup("Тук управлявате съдържанието на сайта — създавате нови страници, редактирате съществуващи и организирате страниците в родителска йерархия. Използвайте „Нова страница“, за да добавите страница. В таблицата можете да сортирате по име, slug или дата на обновяване, а чрез менюто „Действия“ да редактирате съдържанието, статуса и родителската страница.")}</div><button class="button primary" type="button" @click="startCreate">Нова страница</button></div><div class="notice error" x-show="error" x-text="error"></div><div class="pages-table">${dataTableMarkup("pages", [{ key: "title", label: "Име", sortable: true, linkTemplate: "/admin/pages/{id}/edit" }, { key: "slug", label: "Slug", sortable: true }, { key: "updated_at", label: "Дата на обновяване", sortable: true }], actionDropdownMarkup('<button class="dropdown-option" type="button" @click="startEdit(row)">Редактирай</button>'))}</div></section></template>
          <template x-if="page === 'pages-create' || page === 'pages-edit'"><section><div class="page-heading-row"><div>${breadcrumbsMarkup("page === 'pages-edit' ? 'Редактиране на страница' : 'Създаване на страница'", [{ label: "Страници", href: "/admin/pages" }])}<h1 x-text="page === 'pages-edit' ? 'Редактиране на страница' : 'Създаване на страница'"></h1>${collapsibleTextMarkup("В този формуляр създавате или редактирате страница от сайта. Въведете заглавие — системата ще генерира автоматично slug адреса. Изберете родителска страница, ако страницата трябва да бъде част от йерархия. Добавете съдържание чрез текстовия редактор, изберете статус и запазете промените. Невалидните полета ще бъдат маркирани с конкретно съобщение.")}</div><button class="button primary" type="button" @click="startCreate" x-show="page === 'pages-edit'">Нова страница</button></div><div class="notice error" x-show="error" x-text="error"></div><form class="page-form" @submit.prevent="savePage"><label>Заглавие<input data-slot="input" type="text" x-model="form.title" maxlength="190" @input="form.slug = slugify(form.title)" :aria-invalid="fieldErrors.title ? true : undefined"><span class="field-error" x-show="fieldErrors.title" x-text="fieldErrors.title"></span></label><label>URL адрес (slug)<input data-slot="input" type="text" x-model="form.slug" readonly :aria-invalid="fieldErrors.slug ? true : undefined"><span class="field-error" x-show="fieldErrors.slug" x-text="fieldErrors.slug"></span></label>${parentDropdownMarkup()}${richTextEditorMarkup("form.content", "Съдържание")}<label>Статус<select data-slot="select-trigger" x-model="form.status"><option value="draft">Чернова</option><option value="published">Публикувана</option></select><span class="field-error" x-show="fieldErrors.status" x-text="fieldErrors.status"></span></label><div class="page-form-actions"><button class="button primary" type="submit" :disabled="saving" x-text="saving ? 'Записване…' : 'Запази страницата'"></button><button class="button secondary" type="button" @click="navigate('/admin/pages')">Отказ</button></div></form></section></template>
          <template x-if="page === 'updates'"><section>${breadcrumbsMarkup("'Обновявания'")}<h1>Обновявания</h1><p class="lead">Качете ZIP пакет за версията и стартирайте контролирано обновяване.</p><div class="notice success" x-show="notice" x-text="notice"></div><div class="notice error" x-show="error" x-text="error"></div><section class="content-card"><header>${sectionHeader("Качване на platform пакет", "updates-upload")}</header><div class="section-body" x-show="!isSectionCollapsed('updates-upload')"><form method="post" action="/admin/updates/install" enctype="multipart/form-data"><input type="hidden" name="_token" :value="csrfToken"><input type="hidden" name="mode" value="install"><label>ZIP пакет на новата версия<input type="file" name="package" accept="application/zip,.zip" required></label><button class="button primary" type="submit">Актуализирай платформата</button></form><p class="muted">Системата проверява checksum, цифровия подпис и съвместимостта, създава backup, изпълнява миграциите и прави health check.</p></div></section><section class="content-card"><header>${sectionHeader("История", "updates-history")}</header><div class="section-body" x-show="!isSectionCollapsed('updates-history')"><div class="table-wrapper"><table><thead><tr><th>Тип</th><th>ID</th><th>От</th><th>До</th><th>Дата</th><th>Действия</th></tr></thead><tbody><template x-for="item in history" :key="item.id"><tr><td x-text="item.type"></td><td x-text="item.id"></td><td x-text="item.from"></td><td x-text="item.to"></td><td x-text="item.installed_at || item.rolled_back_at"></td><td><form method="post" action="/admin/updates/rollback"><input type="hidden" name="_token" :value="csrfToken"><input type="hidden" name="id" :value="item.id"><button class="button secondary" type="submit">Rollback</button></form></td></tr></template></tbody></table></div></div></section></section></template>
        </main>
      </div>
      <div class="admin-system-footer"><span>Flex CMS</span><strong>v${escapeHtml(readBootstrap()?.version ?? "")}</strong></div>
    </div>`

  const withDropdowns = markup
    .replace(/<select x-model="theme" @change="saveTheme">.*?<\/select>/, dropdownMarkup("theme", [{ value: "system", label: "Системна" }, { value: "light", label: "Светла" }, { value: "dark", label: "Тъмна" }], "saveTheme()"))
    .replace(/<select data-slot="select-trigger" x-model="form.status">.*?<\/select>/, dropdownMarkup("form.status", [{ value: "draft", label: "Чернова" }, { value: "published", label: "Публикувана" }]))

  const withControls = withDropdowns
    .replaceAll('<input data-slot="input"', '<input class="form-control" data-slot="input"')
    .replaceAll('<textarea ', '<textarea class="form-control" ')
    .replaceAll('<input type="file"', '<input class="form-control" type="file"')

  const withHints = withControls
    .replace(/<label>Заглавие(<input[^>]*>)/, `<label><span class="field-label">Заглавие${fieldHintMarkup("Въведете ясно и кратко име на страницата. Използва се и за автоматичното генериране на slug.")}</span>$1`)
    .replace(/<label>URL адрес \(slug\)(<input[^>]*>)/, `<label><span class="field-label">URL адрес (slug)${fieldHintMarkup("Slug адресът се генерира автоматично от заглавието и се използва в URL адреса на страницата.")}</span>$1`)
    .replace(/<div class="rich-text-field"><label class="rich-text-label">Съдържание<\/label>/, `<div class="rich-text-field"><label class="rich-text-label"><span class="field-label">Съдържание${fieldHintMarkup("Използвайте toolbar-а за форматиране на текста, списъци, заглавия, линкове и блокови елементи.")}</span></label>`)
    .replace(/<label>ZIP пакет на новата версия(<input[^>]*>)/, `<label><span class="field-label">ZIP пакет на новата версия${fieldHintMarkup("Изберете валиден ZIP пакет с release на платформата. Системата ще провери подписа, checksum-а и съвместимостта.")}</span>$1`)

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

function createAdminState(initial: Bootstrap) {
  const state = {
    page: initial.page, pageTitle: "", csrfToken: initial.csrfToken, version: initial.version,
    width: initial.sidebarWidth, collapsed: initial.sidebarCollapsed ?? false, mobileOpen: false, isMobile: false,
    user: initial.user ?? { name: "", email: "", role: "", status: "" }, theme: localStorage.getItem("flexcms.admin.theme") ?? "system",
    pages: initial.pages ?? [], history: initial.history ?? [], notice: initial.notice ?? "", error: initial.error ?? "", inspection: initial.inspection, collapsedSections: initial.collapsedSections ?? {},
    editingId: null as number | null, saving: false, fieldErrors: {} as FieldErrors,
    form: { title: "", slug: "", content: "", parentId: "" as string | number, status: "draft" as "draft" | "published" },
    init() { this.syncMedia(); window.addEventListener("resize", () => this.syncMedia()); this.saveTheme(); setTimeout(() => this.syncCollapsedSections(), 0) },
    syncMedia() { this.isMobile = window.matchMedia("(max-width: 48rem)").matches; if (!this.isMobile) this.mobileOpen = false },
    toggleSidebar() { if (this.isMobile) { this.mobileOpen = !this.mobileOpen } else { this.collapsed = !this.collapsed; $.ajax({ url: "/admin/sidebar-width", method: "POST", data: { _token: this.csrfToken, collapsed: this.collapsed ? "1" : "0" }, headers: { "X-CSRF-Token": this.csrfToken } }) } },
    toggleSection(key: string, element: HTMLElement) { this.collapsedSections[key] = !this.collapsedSections[key]; element.closest(".content-card")?.classList.toggle("is-collapsed", this.collapsedSections[key]); $.ajax({ url: "/admin/section-state", method: "POST", data: { _token: this.csrfToken, key, collapsed: this.collapsedSections[key] ? "1" : "0" }, headers: { "X-CSRF-Token": this.csrfToken } }) },
    isSectionCollapsed(key: string) { return this.collapsedSections[key] === true },
    syncCollapsedSections() { document.querySelectorAll<HTMLElement>(".section-header[data-section-key]").forEach((header) => { header.closest(".content-card")?.classList.toggle("is-collapsed", this.isSectionCollapsed(header.dataset.sectionKey ?? "")) }) },
    navigate(url: string, pushHistory = true) { $.get(url, (markup: string) => { const next = new DOMParser().parseFromString(markup, "text/html").getElementById("flex-admin-bootstrap"); if (!next) return; this.applyBootstrap(JSON.parse(next.textContent ?? "{}") as Bootstrap); if (pushHistory) window.history.pushState({}, "", url); window.scrollTo({ top: 0, behavior: "smooth" }) }, "html").fail(() => { this.error = "Страницата не можа да бъде заредена."; showToast(this.error, "error") }) },
    slugify(value: string) { return slugifyPageTitle(value) },
    saveTheme() { localStorage.setItem("flexcms.admin.theme", this.theme); document.documentElement.classList.remove("light", "dark"); document.documentElement.classList.add(this.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : this.theme) },
    startCreate() { this.navigate("/admin/pages/create") },
    startEdit(item: PageRecord) { this.navigate(`/admin/pages/${item.id}/edit`) },
    savePage() { const payload = { ...this.form, parent_id: this.form.parentId === "" ? null : Number(this.form.parentId) }; const parsed = pageFormSchema.safeParse(payload); if (!parsed.success) { this.fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])) as FieldErrors; this.error = "Моля, поправете маркираните полета."; showToast(this.error, "error"); return } this.saving = true; $.ajax({ url: this.editingId === null ? "/api/pages" : `/api/pages/${this.editingId}`, method: this.editingId === null ? "POST" : "PATCH", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify(parsed.data) }).done(() => { showToast(this.editingId === null ? "Страницата е създадена." : "Страницата е обновена.", "success"); this.navigate("/admin/pages") }).fail((xhr: JQuery.jqXHR) => { const details = (xhr.responseJSON?.error?.details?.fields ?? {}) as Record<string, string[]>; this.fieldErrors = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value[0]])) as FieldErrors; this.error = xhr.responseJSON?.error?.message ?? "Неуспешно записване на страницата."; showToast(this.error, "error") }).always(() => { this.saving = false }) },
    applyBootstrap(next: Bootstrap) { this.page = next.page; this.pageTitle = ({ dashboard: "Табло", updates: "Обновявания", pages: "Страници", "pages-create": "Създаване на страница", "pages-edit": "Редактиране на страница", profile: "Профил" } as Record<string, string>)[next.page]; this.csrfToken = next.csrfToken; this.width = next.sidebarWidth; this.collapsed = next.sidebarCollapsed ?? false; this.collapsedSections = next.collapsedSections ?? {}; this.pages = next.pages ?? this.pages; this.history = next.history ?? []; this.notice = next.notice ?? ""; this.error = next.error ?? ""; this.inspection = next.inspection; const pageData = next.pageData ?? null; this.editingId = pageData?.id ?? null; this.form = pageData ? { title: pageData.title, slug: pageData.slug, content: pageData.content, parentId: pageData.parent_id ?? "", status: pageData.status } : { title: "", slug: "", content: "", parentId: "", status: "draft" }; this.fieldErrors = {}; this.mobileOpen = false; setTimeout(() => this.syncCollapsedSections(), 0) },
  }
  const initialPageData = initial.pageData ?? null
  state.editingId = initialPageData?.id ?? null
  state.form = initialPageData ? { title: initialPageData.title, slug: initialPageData.slug, content: initialPageData.content, parentId: initialPageData.parent_id ?? "", status: initialPageData.status } : state.form
  state.pageTitle = ({ dashboard: "Табло", updates: "Обновявания", pages: "Страници", "pages-create": "Създаване на страница", "pages-edit": "Редактиране на страница", profile: "Профил" } as Record<string, string>)[initial.page]
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
    window.requestAnimationFrame(alignBreadcrumbsBelowDescription)
  })
  breadcrumbObserver.observe(root, { childList: true, subtree: true })
  window.requestAnimationFrame(alignBreadcrumbsBelowDescription)
}
