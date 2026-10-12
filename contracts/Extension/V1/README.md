# Extension API v1

### Optional services (Flex CMS 0.1.64+)

`PluginContext::$services` is an optional `PluginServicesInterface`. Older context construction remains compatible. Services provide session CSRF, plugin-scoped JSON document storage (`storage.documents`), platform mail with an explicit visitor Reply-To (`mail.send`), and active-theme descriptors/templates (`theme.extensions`). The last three capabilities require approved permissions. Storage transactions serialize new-key checks/writes within the plugin and the site's database. Apply the `extension_documents` migration before using storage.

Themes may declare `extensions: {"vendor/plugin": "relative/descriptor.json"}` in theme.json. Descriptor contract version must be 1. The descriptor and template entrypoint are resolved inside the active theme with traversal and symlink containment checks. Extension-specific schemas are validated by the owning plugin, on both GET and POST. PHP templates and autoescaped Twig templates receive only the supplied view model.

PHP themes receive `$flex_extension($extension, $id)`; Twig themes use `{{ flex_extension(extension, id) }}`. Both apply `public.extension.render` with `extension` and `id`. An inactive/absent plugin returns empty output. Custom renderers can apply the same hook, and must print platform frontend asset tags.

`http.response` receives the PSR response after routing; it can set response policy (for example private/no-store on a page containing session-specific form tokens). Callbacks must return a ResponseInterface. `php bin/flex extensions:maintain` boots active plugins and dispatches `extensions.maintenance`; configure it periodically on the host for outbox/retention tasks. No contact-form-specific logic is built into this command.

To report a handled server-side failure to the platform operation error journal (shown under Settings → Maintenance), dispatch `operation.error.report` with `message`, optional `scope` (`plugin`, `theme`, `extension`), `component`, `operation`, optional `exception` (`\Throwable`), and optional `context` array. Do not pass secrets in `context`.

Version 1 exposes the minimum plugin lifecycle contract. A plugin entrypoint must implement
`PluginInterface` and receive a read-only `PluginContext` when it is installed, activated or
deactivated. The context contains the plugin id, version, installation path and validated
manifest data and declared permissions. Permission checks use a default-deny policy:
`routes.public` is required for plugin routes and `frontend.assets` is required for
frontend CSS/JavaScript assets; with it, `PluginContext::$assets` (Flex CMS 0.1.62+) loads groups of public files only on the pages that need them (`enqueue()`, `enqueueWhen()`, see `docs/admin-extension-pages.md`). An optional `UninstallablePluginInterface` can be implemented when a plugin
needs to remove its own versioned data. Internal platform services are deliberately not
exposed through this API. An optional `UpdatablePluginInterface` can run plugin-specific
migrations when a discovered package has a newer version than the installed one.

Declared permissions are stored as requested permissions during installation. A super
administrator must approve them before activation; runtime contexts, routes and frontend
assets receive only approved permissions. Permission changes require the plugin to be inactive.

Plugins with the `admin.ui` permission can register safe administrative UI descriptors:
sidebar links and `notice`, `card` or `link` components in approved slots such as
`admin.dashboard.before`, `admin.pages.table.before` and `admin.page.form.after`.
Raw HTML and editor slots are intentionally not part of this API.

Plugins with `admin.ui` can also register structured page fields through
`PluginContext::$pageFields`: `text`, `textarea` and `checkbox`. Submitted values
are namespaced by plugin ID and exposed on `PageEvent::$fields`, allowing the
plugin to store them in its own table. The platform does not persist plugin fields
in the core pages table.

The registrar's `values()` method accepts a resolver that receives a page ID and
returns the plugin's saved values. Those values are included when the page form is
opened, so edit forms can be hydrated without coupling the platform to the plugin's
storage.

Declared permissions are stored as requested permissions during installation. A super
administrator must approve them before activation; runtime contexts and frontend assets
receive only approved permissions. Permission changes require the plugin to be inactive.
The `ExtensionApiInterface` provides namespaced actions and filters. Plugins can register
callbacks during their lifecycle and use `applyFilters()` or `doAction()` without depending
on internal framework services. Active plugins that implement `BootablePluginInterface` are
booted once per application request before routing starts.
During boot, `PluginContext::$routes` can register namespaced routes. A route such as
`/hello` registered with `get()` is exposed as `/plugins/{plugin-id}/hello`. Plugins can
also use `publicRoute()` for intentionally short site-root paths such as `/cart`; these
routes still require the approved `routes.public` permission. Route names remain scoped to
the plugin, and middleware can be supplied when needed. Public plugin routes are ordered
before the CMS page fallback.
Public page rendering applies these filters:

- `public.content` receives the page HTML and `['page' => array]`; it must return HTML.
- `public.head` receives `''` and `['page' => array, 'request' => ServerRequestInterface]`; it returns
  extra `<head>` markup. Themes print it unchanged, so callbacks must escape their own output.
- `public.title` receives the page title and the same context; it returns the document `<title>` text.
  Themes receive it as `document_title` and must escape it. Empty results fall back to the page title.

Plugins that render their own public pages may apply `public.head` and `public.title` with a different
context, for example Flex Commerce passes `['commerce' => array, 'request' => ServerRequestInterface]`.
Core events are exposed through `EventNames` and immutable event objects such as
`PluginEvent` and `PageEvent`. Listeners are ordered by priority and receive only the
validated public payload.

### Admin extension points

`AdminExtensionRegistrarInterface::extend($point, $slot, $id, $module, $options)` (0.1.60+) adds content to any named collapsible section, table or screen of the admin: section content and nested sections, screen sections and tabs, table columns, row actions, bulk actions and toolbar filters. The catalog of names and the slot contracts are in `docs/admin-extension-points.md`.

### Admin panels

`AdminExtensionRegistrarInterface::panel($location, $id, $label, $module, $options)` places a React panel inside a platform screen: `page.editor`, `page.settings`, `pages.list.column`, `settings.tab`, `commerce.product.editor` or `commerce.category.editor`. Panels receive the unsaved record values and save after the record through `registerSave`. See `docs/admin-extension-pages.md`.

### Administrative navigation

React pages can declare an optional navigation descriptor:

```php
$context->admin?->page('photos', 'Photos', 'assets/admin.js', false, ['group' => 'content', 'icon' => 'images']);
```

Groups: content, appearance, commerce, management, system, account, extensions. Icons: puzzle, images, shopping-bag, file-text, settings, users, palette. Omitted navigation uses extensions/puzzle. Empty groups are hidden.

### Time

The platform stores and processes every time value in UTC and converts it only in the browser.

- **Server:** PHP runs with `date_default_timezone_set('UTC')`, and the MySQL session time zone is `+00:00`. Write times with `Time::now()`, `gmdate()` or `new DateTimeImmutable('now', new DateTimeZone('UTC'))`. A stored string without a zone (`Y-m-d H:i:s`) is always UTC.
- **API and HTML:** send UTC. Prefer ISO 8601 with `Z` from `Time::iso($value)`, for example `2026-10-10T12:00:00Z`.
- **Display:** never format times for people on the server, with `toLocaleString()` or by slicing strings. Use the platform time module, which shows the exact time in the viewer's time zone and the relative time, for example „10.10.2026 14:30 · преди 5 минути“, and keeps the relative part current. Date and time formats come from the general settings.

| Where | How |
| --- | --- |
| PHP | `Flex\Extension\V1\Time::iso()`, `Time::html($value, 'datetime'\|'date'\|'relative')` |
| Twig in the core and themes | `{{ flex_time(value) }}`, `{{ flex_time(value, 'date') }}` |
| Twig in a plugin's own environment | register `new TwigFunction('flex_time', [Time::class, 'html'], ['is_safe' => ['html']])` |
| Admin plugin modules | `host.components.DateTime` (`{value, style}`) and `host.time` (`formatFull`, `formatExact`, `formatRelative`, `parse`, `isoUtc`, `dayjs`) |
| Public scripts | `import { formatFull, enhance } from '/assets/flex-time.js'` (always this exact URL) |
| Any HTML | `<time datetime="2026-10-10T12:00:00Z" data-flex-time="datetime">fallback</time>` |

`/assets/flex-time.js` is built with Day.js from `resources/admin-react/src/lib/flex-time.ts` (`npm --prefix resources/admin-react run build:time`). Themes load it once per page and print `data-flex-date-format` and `data-flex-time-format` on `<html>`; it then fills every `<time data-flex-time>` on load and after `flex:page-ready`. Plugins that must also run on older platforms check that `components.DateTime` exists and load the module with a dynamic `import()` that falls back to the UTC value.
