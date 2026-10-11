# React administration extension API

Active plugins with `admin.ui` can register an administration module:

```php
$context->admin?->page('items', 'Items', 'assets/admin.js', true);
```

The module must also be listed in `frontend.scripts` with the `frontend.assets` permission. It is served only while the plugin is active. The generated page URL is `/extension-pages/vendor-plugin-items`; create and edit routes may append `/create` or `/{id}/edit`.

A page that should not appear in the sidebar, for example an editor opened only from a row action, passes `'hidden' => true` in the navigation options (Flex CMS 0.1.61+). It keeps its address and opens only by it:

```php
$context->admin?->page('editor', 'Editor', 'assets/admin.js', false, ['hidden' => true]);
// opened at /extension-pages/vendor-plugin-editor/{id}/edit
```

The admin workspace opens plugin pages only at the page address, `/create` and `/{id}/edit`; other sub-paths fall back to the dashboard.

Modules export `createPage(host)`, returning a React component that receives `path` and `navigate(path)`. Embeddable modules additionally export `createEmbedPicker(host)`; the editor passes `onInsert(text)` and `onClose()`. The core provides its existing React instance, selected icons, universal UI components, `request(url, method, body, signal)` with credentials/CSRF/timeouts, toast notifications, and hooks `useWorkspaceChanged()` and `useWorkspaceSaved()`.

`host.components` includes Breadcrumbs, CollapsibleSection, ConfirmDialog, DataTable, DropdownMenu, DropdownOption, DropdownChevron, TableActionsMenu, LoadingButton, MediaPicker, Input, Textarea, Button, Dialog and Hint. Page components render inside AdminShell, sharing navigation, reload, workspace tabs, local persistence and theme tokens. Plugins must mark edits and successful saves using the provided hooks.

The header of every screen has a **Помощ** (help) button. It opens a dialog with the guidance of the current screen and a switch that shows or hides inline guidance for the user (stored in the browser). Plugins add guidance with `host.usePageHelp({title, content})`, called in their page component on every render; the entry is shown while the component is mounted. Short inline guidance uses `host.components.Hint` (`{children}`): it is hidden when the user turns guidance off, and its close button does the same. Status messages that the user must see, such as errors or conflicts, should not use `Hint`.

`MediaPicker` supports `multiple: true` and `onSelectMany(records)` in addition to its existing single-image mode. Original media metadata must not be changed by gallery-specific fields.

Plugins can transform public HTML using `public.content`. The filter receives the content string and a context with `page`, and is applied to a copy of the Page before rendering PHP or Twig themes. It also applies to theme previews. Output is never persisted back to page content. Plugins are responsible for escaping generated HTML and validating URLs.


## Public assets per page

Files listed under `frontend.public.scripts` and `frontend.public.styles` load on every public page. Since Flex CMS 0.1.62 a plugin can instead list files in named groups and load a group only on the pages that use it:

```json
"frontend": {"public": {
  "scripts": ["assets/header.js"],
  "groups": {"gallery": {"scripts": ["assets/gallery.js"], "styles": ["assets/gallery.css"]}}
}}
```

```php
// While rendering, for example in a controller or a public.content filter:
$context->assets?->enqueue('gallery');
// At boot, for a group whose need is known only later; the condition runs when the page's tags are built:
$context->assets?->enqueueWhen('bar', static fn(): bool => (new BarSettings())->enabled());
```

Group names use lowercase letters, digits and hyphens. A group is printed once per page, after the files for every page; files already on the page are left out. Both methods require the `frontend.assets` permission. All public file URLs carry `?v=` with the file's version (for modules, including the modules they import) and are cached by browsers until the file changes; relative imports inside modules are given the same versions. Twig themes print the tags with `{{ frontend_extension_tags() }}`, PHP themes with `$frontend_extension_tags`.
Admin API routes registered with `$context->routes->admin(...)` remain namespaced under `/admin/plugins/vendor/plugin/...` and guarded by authentication, superadmin and CSRF middleware. Asset URLs use `/extensions/vendor/plugin/assets/relative/path.js`; no Apache encoded-slash exception is required.

Flex Galleries in `plugins/flex/galleries` is a reference implementation. Its files are a separate extension package, excluded from core releases by the existing project layout.

## Panels inside platform screens

> Since Flex CMS 0.1.60 panels are part of the general extension points: every named section and table accepts plugin content through `$context->admin->extend()`. See [admin-extension-points.md](admin-extension-points.md) for the slots and the catalog of names; `panel()` below remains as shorthand.

A plugin can also place a React panel directly inside a platform screen, so administrators work with its features where they edit content instead of on a separate page:

```php
$context->admin?->panel('page.editor', 'meta', 'SEO', 'assets/panels.js', ['icon' => 'file-text', 'order' => 10]);
$context->admin?->panel('pages.list.column', 'score', 'SEO', 'assets/panels.js');
$context->admin?->panel('settings.tab', 'settings', 'SEO', 'assets/panels.js');
```

| Location | Shown in | Props / contract |
| --- | --- | --- |
| `page.editor` | the page editor, after "Съдържание" | `context: {type: 'page', id, values: {title, slug, content, featured_media_id, status, parent_id}}` |
| `page.settings` | the page settings screen | `context: {type: 'page', id, page, settings}` |
| `commerce.product.editor`, `commerce.category.editor` | the Flex Commerce editors (rendered by Flex Commerce) | `context: {type: 'product' \| 'category', id, values}` |
| `settings.tab` | an extra tab in Settings | `navigate(path)`; the panel saves on its own |
| `pages.list.column` | a column in the pages list | export `createColumn(host, info)` returning `{label?, load(rows), render(row, data), sortValue?(row, data)}` |

The module exports `createPanel(host, info)` (or the function named by `options.export`) returning a React component; `info` is `{location, id}`. Editor panels receive `context` (the unsaved values, updated while the user types), `changed()`, `navigate(path)` and `registerSave(handler)`. The screen saves its own record first and then calls every handler with `{id}`, so panels on a new record receive its ID; `registerSave` returns the unregister function and fits a `useEffect`. A handler that throws keeps the tab marked as unsaved and shows its message. `id` is `null` while a record is new.

Each panel is rendered in its own collapsible section titled with the panel label, inside an error boundary, so a failing plugin never breaks the screen. Options: `order` (default 50), `icon`, `default_open` (default true) and `export`. The module must be listed in `frontend.scripts`, like page modules.

Plugin screens can host panels of other plugins with `host.components.ExtensionPanels` (`{location, context, saves}`) and `host.usePanelSaves()` (`{register, run}`). `host.openSettingsTab(id)` selects a plugin settings tab before navigating to `/settings`.

Flex SEO (`plugins/flex/seo/assets/panels.js`) is the reference implementation.
