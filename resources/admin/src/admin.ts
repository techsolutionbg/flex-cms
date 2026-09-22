import Alpine from "alpinejs"
import $ from "jquery"

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
}

type Bootstrap = {
  page: "dashboard" | "updates" | "profile" | "pages"
  csrfToken: string
  sidebarWidth: number
  version: string
  user?: { name: string; email: string; role: string; status: string }
  pages?: PageRecord[]
  history?: Array<Record<string, string | boolean | undefined>>
  notice?: string | null
  error?: string | null
  inspection?: { version?: string; files?: number; migrations?: boolean } | null
}

type FieldErrors = Partial<Record<"title" | "slug" | "status", string>>

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

function adminMarkup(): string {
  return `
    <div class="admin-shell sidebar-enhanced" x-data="adminApp" :class="{ 'sidebar-collapsed': collapsed, 'sidebar-mobile-open': mobileOpen }" :style="\`--sidebar-width: \${width}px\`">
      <aside id="admin-sidebar" class="admin-sidebar" :aria-hidden="isMobile && !mobileOpen">
        <button class="sidebar-toggle" type="button" aria-label="Покажи или прибери страничната лента" @click="toggleSidebar" :aria-expanded="!collapsed || mobileOpen"><span aria-hidden="true">☰</span></button>
        <div class="sidebar-brand"><img class="sidebar-logo" src="/assets/brand/logo.png" alt="Flex CMS"></div>
        <nav aria-label="Административна навигация"><ul class="sidebar-nav-list">
          <li><a class="sidebar-link" href="/admin" :class="{ 'is-active': page === 'dashboard' }"><span class="sidebar-icon" aria-hidden="true">⌂</span><span class="sidebar-link-label">Табло</span></a></li>
          <li><a class="sidebar-link" href="/admin/updates" :class="{ 'is-active': page === 'updates' }"><span class="sidebar-icon" aria-hidden="true">↻</span><span class="sidebar-link-label">Обновявания</span></a></li>
          <li><a class="sidebar-link" href="/admin/pages" :class="{ 'is-active': page === 'pages' }"><span class="sidebar-icon" aria-hidden="true">▤</span><span class="sidebar-link-label">Страници</span></a></li>
          <li><a class="sidebar-link" href="/admin/profile" :class="{ 'is-active': page === 'profile' }"><span class="sidebar-icon" aria-hidden="true">♙</span><span class="sidebar-link-label">Профил</span></a></li>
        </ul></nav>
        <div class="sidebar-footer"><span>Flex CMS</span><strong>v${escapeHtml(readBootstrap()?.version ?? "")}</strong></div>
      </aside>
      <button class="sidebar-backdrop" type="button" aria-label="Затвори страничната лента" x-show="mobileOpen" @click="mobileOpen = false"></button>
      <div class="admin-main">
        <header class="admin-topbar"><div class="topbar-title" x-text="pageTitle"></div><div class="topbar-actions"><form method="post" action="/logout"><input type="hidden" name="_token" :value="csrfToken"><button class="logout" type="submit">Изход</button></form></div></header>
        <main class="admin-content">
          <template x-if="page === 'dashboard'"><section><h1>Административен панел</h1><p class="lead">Имате пълен достъп до системната администрация като супер администратор.</p><section class="dashboard-grid"><article class="content-card"><h2>Потребители</h2><p>Управление на потребители, роли и статуси.</p><a href="/api/users">Отвори API →</a></article><article class="content-card"><h2>Обновявания</h2><p>Проверка, инсталация и връщане на подписани platform пакети.</p><a href="/admin/updates">Отвори обновявания →</a></article></section></section></template>
          <template x-if="page === 'profile'"><section><h1>Профил</h1><p class="lead">Основни данни за текущия потребител.</p><section class="content-card profile-card"><h2>Данни на потребителя</h2><dl class="profile-details"><div><dt>Име</dt><dd x-text="user.name"></dd></div><div><dt>Имейл</dt><dd x-text="user.email"></dd></div><div><dt>Роля</dt><dd x-text="user.role"></dd></div><div><dt>Статус</dt><dd x-text="user.status"></dd></div></dl></section><section class="content-card profile-card"><h2>Настройки на темата</h2><label class="profile-setting"><span>Тема на приложението</span><select x-model="theme" @change="saveTheme"><option value="system">Системна</option><option value="light">Светла</option><option value="dark">Тъмна</option></select><span class="muted">По подразбиране се използва системната тема.</span></label></section></section></template>
          <template x-if="page === 'pages'"><section><div class="page-heading-row"><div><h1>Страници</h1><p class="lead">Създавайте и редактирайте страниците на сайта.</p></div><button class="button primary" type="button" @click="startCreate">Нова страница</button></div><div class="notice error" x-show="error" x-text="error"></div><section class="content-card"><h2 x-text="editingId === null ? 'Създаване на страница' : 'Редактиране на страница'"></h2><form class="page-form" @submit.prevent="savePage"><label>Заглавие<input data-slot="input" type="text" x-model="form.title" maxlength="190" @input="form.slug = slugify(form.title)" :aria-invalid="fieldErrors.title ? true : undefined"><span class="field-error" x-show="fieldErrors.title" x-text="fieldErrors.title"></span></label><label>URL адрес (slug)<input data-slot="input" type="text" x-model="form.slug" readonly :aria-invalid="fieldErrors.slug ? true : undefined"><span class="field-error" x-show="fieldErrors.slug" x-text="fieldErrors.slug"></span></label><label>Съдържание<textarea x-model="form.content" rows="10"></textarea></label><label>Статус<select data-slot="select-trigger" x-model="form.status"><option value="draft">Чернова</option><option value="published">Публикувана</option></select><span class="field-error" x-show="fieldErrors.status" x-text="fieldErrors.status"></span></label><div class="page-form-actions"><button class="button primary" type="submit" :disabled="saving" x-text="saving ? 'Записване…' : 'Запази страницата'"></button><button class="button secondary" type="button" x-show="editingId !== null" @click="startCreate">Отказ</button></div></form></section><section class="content-card"><h2>Всички страници</h2><p class="muted" x-show="pages.length === 0">Все още няма създадени страници.</p><div class="pages-list"><template x-for="item in pages" :key="item.id"><article class="page-list-item"><div><h3 x-text="item.title"></h3><p class="muted">/<span x-text="item.slug"></span></p></div><div class="page-list-meta"><span class="page-status" :class="\`page-status-\${item.status}\`" x-text="item.status === 'published' ? 'Публикувана' : 'Чернова'"></span><button class="button secondary" type="button" @click="startEdit(item)">Редактирай</button></div></article></template></div></section></section></template>
          <template x-if="page === 'updates'"><section><h1>Обновявания</h1><p class="lead">Качете ZIP пакет за версията и стартирайте контролирано обновяване.</p><div class="notice success" x-show="notice" x-text="notice"></div><div class="notice error" x-show="error" x-text="error"></div><section class="content-card"><h2>Качване на platform пакет</h2><form method="post" action="/admin/updates/install" enctype="multipart/form-data"><input type="hidden" name="_token" :value="csrfToken"><input type="hidden" name="mode" value="install"><label>ZIP пакет на новата версия<input type="file" name="package" accept="application/zip,.zip" required></label><button class="button primary" type="submit">Актуализирай платформата</button></form><p class="muted">Системата проверява checksum, цифровия подпис и съвместимостта, създава backup, изпълнява миграциите и прави health check.</p></section><section class="content-card"><h2>История</h2><div class="table-wrapper"><table><thead><tr><th>Тип</th><th>ID</th><th>От</th><th>До</th><th>Дата</th><th>Действия</th></tr></thead><tbody><template x-for="item in history" :key="item.id"><tr><td x-text="item.type"></td><td x-text="item.id"></td><td x-text="item.from"></td><td x-text="item.to"></td><td x-text="item.installed_at || item.rolled_back_at"></td><td><form method="post" action="/admin/updates/rollback"><input type="hidden" name="_token" :value="csrfToken"><input type="hidden" name="id" :value="item.id"><button class="button secondary" type="submit">Rollback</button></form></td></tr></template></tbody></table></div></section></section></template>
        </main>
      </div>
    </div>`
}

function createAdminState(initial: Bootstrap) {
  const state = {
    page: initial.page, pageTitle: "", csrfToken: initial.csrfToken, version: initial.version,
    width: initial.sidebarWidth, collapsed: false, mobileOpen: false, isMobile: false,
    user: initial.user ?? { name: "", email: "", role: "", status: "" }, theme: localStorage.getItem("flexcms.admin.theme") ?? "system",
    pages: initial.pages ?? [], history: initial.history ?? [], notice: initial.notice ?? "", error: initial.error ?? "", inspection: initial.inspection,
    editingId: null as number | null, saving: false, fieldErrors: {} as FieldErrors,
    form: { title: "", slug: "", content: "", status: "draft" as "draft" | "published" },
    init() { this.syncMedia(); window.addEventListener("resize", () => this.syncMedia()) },
    syncMedia() { this.isMobile = window.matchMedia("(max-width: 48rem)").matches; if (!this.isMobile) this.mobileOpen = false },
    toggleSidebar() { if (this.isMobile) { this.mobileOpen = !this.mobileOpen } else { this.collapsed = !this.collapsed } },
    slugify(value: string) { return slugifyPageTitle(value) },
    saveTheme() { localStorage.setItem("flexcms.admin.theme", this.theme); document.documentElement.classList.remove("light", "dark"); document.documentElement.classList.add(this.theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : this.theme) },
    startCreate() { this.editingId = null; this.form = { title: "", slug: "", content: "", status: "draft" }; this.fieldErrors = {}; this.error = "" },
    startEdit(item: PageRecord) { this.editingId = item.id; this.form = { title: item.title, slug: slugifyPageTitle(item.title), content: item.content, status: item.status }; this.fieldErrors = {}; this.error = "" },
    savePage() { const parsed = pageFormSchema.safeParse(this.form); if (!parsed.success) { this.fieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])) as FieldErrors; this.error = "Моля, поправете маркираните полета."; return } this.saving = true; $.ajax({ url: this.editingId === null ? "/api/pages" : `/api/pages/${this.editingId}`, method: this.editingId === null ? "POST" : "PATCH", contentType: "application/json", dataType: "json", headers: { "X-CSRF-Token": this.csrfToken }, data: JSON.stringify(parsed.data) }).done((payload: { page: PageRecord }) => { this.pages = this.editingId === null ? [payload.page, ...this.pages] : this.pages.map((item) => item.id === payload.page.id ? payload.page : item); this.startCreate() }).fail((xhr: JQuery.jqXHR) => { const details = (xhr.responseJSON?.error?.details?.fields ?? {}) as Record<string, string[]>; this.fieldErrors = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value[0]])) as FieldErrors; this.error = xhr.responseJSON?.error?.message ?? "Неуспешно записване на страницата." }).always(() => { this.saving = false }) },
    applyBootstrap(next: Bootstrap) { this.page = next.page; this.pageTitle = ({ dashboard: "Табло", updates: "Обновявания", pages: "Страници", profile: "Профил" } as Record<string, string>)[next.page]; this.csrfToken = next.csrfToken; this.version = next.version; this.pages = next.pages ?? []; this.history = next.history ?? []; this.notice = next.notice ?? ""; this.error = next.error ?? ""; this.inspection = next.inspection; this.mobileOpen = false },
  }
  state.pageTitle = ({ dashboard: "Табло", updates: "Обновявания", pages: "Страници", profile: "Профил" } as Record<string, string>)[initial.page]
  return state
}

const initial = readBootstrap()
Alpine.data("loginForm", () => ({ submitting: false }))
if (root && initial) {
  const adminState = createAdminState(initial)
  Alpine.data("adminApp", () => adminState)
  root.innerHTML = adminMarkup()
  $(document).on("click", "a[href^='/admin']", function (this: HTMLAnchorElement, event: JQuery.Event) { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); $.get(this.href, (markup: string) => { const parsed = new DOMParser().parseFromString(markup, "text/html"); const next = parsed.getElementById("flex-admin-bootstrap"); if (!next) return; adminState.applyBootstrap(JSON.parse(next.textContent ?? "{}") as Bootstrap); window.history.pushState({}, "", this.href) }, "html") })
  window.addEventListener("popstate", () => { $.get(window.location.href, (markup: string) => { const next = new DOMParser().parseFromString(markup, "text/html").getElementById("flex-admin-bootstrap"); if (next) adminState.applyBootstrap(JSON.parse(next.textContent ?? "{}") as Bootstrap) }, "html") })
}

Alpine.start()
