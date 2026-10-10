# React administration extension API

Active plugins with `admin.ui` can register an administration module:

```php
$context->admin?->page('items', 'Items', 'assets/admin.js', true);
```

The module must also be listed in `frontend.scripts` with the `frontend.assets` permission. It is served only while the plugin is active. The generated page URL is `/extension-pages/vendor-plugin-items`; create and edit routes may append `/create` or `/{id}/edit`.

Modules export `createPage(host)`, returning a React component that receives `path` and `navigate(path)`. Embeddable modules additionally export `createEmbedPicker(host)`; the editor passes `onInsert(text)` and `onClose()`. The core provides its existing React instance, selected icons, universal UI components, `request(url, method, body, signal)` with credentials/CSRF/timeouts, toast notifications, and hooks `useWorkspaceChanged()` and `useWorkspaceSaved()`.

`host.components` includes Breadcrumbs, CollapsibleSection, ConfirmDialog, DataTable, DropdownMenu, DropdownOption, DropdownChevron, TableActionsMenu, LoadingButton, MediaPicker, Input, Textarea, Button and Dialog. Page components render inside AdminShell, sharing navigation, reload, workspace tabs, local persistence and theme tokens. Plugins must mark edits and successful saves using the provided hooks.

`MediaPicker` supports `multiple: true` and `onSelectMany(records)` in addition to its existing single-image mode. Original media metadata must not be changed by gallery-specific fields.

Plugins can transform public HTML using `public.content`. The filter receives the content string and a context with `page`, and is applied to a copy of the Page before rendering PHP or Twig themes. It also applies to theme previews. Output is never persisted back to page content. Plugins are responsible for escaping generated HTML and validating URLs.

Admin API routes registered with `$context->routes->admin(...)` remain namespaced under `/admin/plugins/vendor/plugin/...` and guarded by authentication, superadmin and CSRF middleware. Asset URLs use `/extensions/vendor/plugin/assets/relative/path.js`; no Apache encoded-slash exception is required.

Flex Galleries in `plugins/flex/galleries` is a reference implementation. Its files are a separate extension package, excluded from core releases by the existing project layout.

## Panels inside platform screens

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
