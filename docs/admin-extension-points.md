# Admin extension points

Plugins add content to the screens of the administration through named **extension points**: collapsible sections, tables and screens. A screen gives its sections and tables a stable name, and the platform components show whatever active plugins registered there. Plugins do not change the platform to get a new place.

Available from Flex CMS 0.1.60. Requires the `admin.ui` permission, and the module must be listed in `frontend.scripts`.

## Registering

```php
$context->admin?->extend(string $point, string $slot, string $id, string $module, array $options = []);
```

```php
// A field at the end of the "Публикуване" section of the page editor.
$context->admin?->extend('page.editor.publishing', 'section.end', 'review', 'assets/admin.js');
// A column and an action in the users table.
$context->admin?->extend('users.list', 'table.column', 'orders', 'assets/admin.js', ['label' => 'Поръчки']);
$context->admin?->extend('users.list', 'table.row-action', 'orders', 'assets/admin.js');
// A nested section inside the Flex Commerce pricing section.
$context->admin?->extend('commerce.product.editor.pricing', 'section.nested', 'vat', 'assets/admin.js', ['label' => 'ДДС', 'icon' => 'sliders']);
```

**Options:**
- `label`: required for `section.nested`, `screen.section` and `screen.tab`; also the default column label.
- `order` (default 50): lower values come first.
- `icon`: `puzzle`, `images`, `shopping-bag`, `file-text`, `settings`, `users`, `palette`, `search`, `key`, `share`, `sliders` or `list-checks`.
- `default_open` (default true): for sections.
- `export`: the module function to call. Without it each slot uses its default export from the table below.

`$context->admin->panel()` from 0.1.59 still works and is shorthand for `extend()`:

| `panel()` location | Point | Slot |
| --- | --- | --- |
| `page.editor` | `page.editor` | `screen.section` |
| `page.settings` | `page.settings` | `screen.section` |
| `pages.list.column` | `pages.list` | `table.column` |
| `settings.tab` | `settings` | `screen.tab` |
| `commerce.product.editor` | `commerce.product.editor` | `screen.section` |
| `commerce.category.editor` | `commerce.category.editor` | `screen.section` |

## Slots

| Slot | Shown | Export | The export returns |
| --- | --- | --- | --- |
| `section.start` | at the start of a section body | `createPanel` | a React component |
| `section.end` | at the end of a section body | `createPanel` | a React component |
| `section.nested` | a nested collapsible section at the end of a section | `createPanel` | a React component; the platform draws the section |
| `screen.section` | a new section of a screen | `createPanel` | a React component; the platform draws the section |
| `screen.tab` | a new tab (Settings) | `createPanel` | a React component |
| `table.column` | a column before "Действия" | `createColumn` | `{label?, load?(rows): Promise, render(row, data), sortValue?(row, data)}` |
| `table.row-action` | an option in the "Действия" menu of each row | `createRowAction` | `{label, onSelect(row, helpers), visible?(row), danger?}` |
| `table.bulk-action` | a button when rows are selected | `createBulkAction` | `{label, run(rows, helpers), danger?}` |
| `table.toolbar` | an element under "Филтри и търсене" | `createToolbar` | a React component |

Every export is called once as `export(host, {point, slot, id, location})`. `host` is the same object admin pages receive: React, components, icons, `request`, `toast`, `time`, workspace hooks.

**Components** (sections, screens and tabs) receive:
- `context`: what the screen shares, see below
- `registerSave(handler)`: returns an unregister function and fits a `useEffect`. The screen saves its record first and then calls every handler with `{id}`, so extensions on a new record receive its ID. A handler that throws keeps the tab marked as unsaved and shows the message.
- `changed()`: marks the tab as unsaved
- `navigate(path)`: opens an admin screen
- `point`, `slot`: where the component is shown

**Table extensions:**
- `helpers` is `{navigate, refresh}`.
- Column `load(rows)` runs once per row set, so a column needs one request, not one per row.
- Toolbar components receive `rows` and `setFilter(fn | null)`. The table shows only the rows every active filter accepts.

Each extension runs inside an error boundary; a failing plugin shows a message instead of breaking the screen.

## Context of a screen

Forms share the record being edited with every extension inside them through `ExtensionScope`:

| Screen | `context` |
| --- | --- |
| Page editor | `{type: 'page', id, values: {title, slug, content, featured_media_id, status, parent_id}}` (unsaved values) |
| Page settings | `{type: 'page', id, page, settings}` |
| Profile | `{type: 'profile', id, values: {name, email, theme}}` |
| Settings → General / a section | `{type: 'settings', id: 'general' \| section, values}` |
| User editor | `{type: 'user', id, values: {name, email, role, status}}` |
| Media editor | `{type: 'media', id, values}` |
| Menu editor, menu structure | `{type: 'menu' \| 'menu-structure', id, values}` |
| Flex Commerce editors | `{type: 'product' \| 'category', id, values}` |

`id` is `null` while a record is new. Read-only screens (dashboard, updates, theme and plugin details) have no context and no save.

## Catalog of points

| Screen | Points |
| --- | --- |
| Page editor | `page.editor` (screen), `page.editor.basic`, `page.editor.featured-image`, `page.editor.content`, `page.editor.publishing` |
| Page settings | `page.settings` (screen), `page.settings.appearance`, `page.settings.navigation`, `page.settings.indexing` |
| Pages list | `pages.list` |
| Profile | `profile.information`, `profile.security`, `profile.appearance` |
| Settings | `settings` (tabs), `settings.general`, `settings.public`, `settings.users`, `settings.media`, `settings.mail`, `settings.updates`, `settings.admin`, `settings.maintenance` (includes the operation error journal UI) |
| Users | `users.list`, `user.editor.details`, `user.editor.password`, `user.editor.confirmation` |
| Media | `media.list`, `media.upload.new`, `media.upload.done`, `media.editor.preview`, `media.editor.file`, `media.editor.metadata` |
| Menus | `menus.list`, `menu.editor.settings`, `menu.structure.pages`, `menu.structure.items` |
| Plugins | `plugins.list`, `plugin.detail.source`, `plugin.detail.information`, `plugin.detail.permissions`, `plugin.detail.manifest` |
| Themes | `theme.detail.overview`, `theme.detail.information`, `theme.detail.features`, `theme.detail.releases` |
| Dashboard | `dashboard.pages`, `dashboard.plugins`, `dashboard.users`, `dashboard.quick-actions`, `dashboard.updates`, `dashboard.version` |
| Updates | `updates.status`, `updates.history`, `updates.releases` |
| Flex Commerce 0.2.7+ | `commerce.product.editor` (screen), `commerce.product.editor.images`, `.basic`, `.pricing`, `.categories`; `commerce.category.editor` (screen), `commerce.category.editor.basic`; `commerce.products.list`, `commerce.categories.list`, `commerce.orders.list`, `commerce.sales.ranking`, `commerce.sales.history` |

Point names are part of the public API and do not change between versions; a renamed section keeps its point name.

## Making a plugin screen extensible

Plugin screens use the same components from `host.components`, so naming them is enough:

```js
h(C.ExtensionScope, {value: {context: {type: 'invoice', id, values: invoice}, saves}},
  h('form', {onSubmit: save},
    h(C.CollapsibleSection, {title: 'Плащане', extensionPoint: 'acme.invoice.editor.payment'}, ...fields),
    h(C.ExtensionPanels, {location: 'acme.invoice.editor', context, saves}),
  ),
)
// after saving the invoice:
await saves.run({id: savedInvoice.id})
```

`saves` comes from `host.usePanelSaves()`. Tables take `extensionPoint` the same way. Document the names in the plugin README.

## Example module

```js
export function createPanel(host) {
  const {React} = host;
  return function ReviewNote({context, registerSave, changed}) {
    const [note, setNote] = React.useState('');
    React.useEffect(() => registerSave(async ({id}) => {
      await host.request('/admin/plugins/acme/review/pages/' + id, 'PUT', {note});
    }), [registerSave, note]);
    return React.createElement(host.components.Textarea, {value: note, onChange: (e) => { setNote(e.target.value); changed(); }});
  };
}

export function createRowAction() {
  return {label: 'Поръчки на потребителя', onSelect: (user, {navigate}) => navigate('/extension-pages/acme-orders?user=' + user.id)};
}
```

Flex SEO (`plugins/flex/seo/assets/panels.js`) is a complete example.
