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
