# Theme Content Schema v1

Themes can declare **global**, **per-layout** (page template), and **per-page** content fields as JSON. The platform plugin **`flex/theme-content`** (a **separate Flex plugin package**, like `flex/seo` — not shipped inside the core CMS repo) loads the schema from the active theme, renders admin forms, stores values in `storage.documents`, and exposes them on the public site through the `public.theme.content` filter and the `$flex_theme_content()` helper in PHP/Twig themes.

Install the plugin under `plugins/flex/theme-content/` from your plugin distribution or updates catalog, then activate it in **Плъгини**.

## File layout

```text
themes/{theme-id}/
  theme.json                 # "content_schema": "fields/manifest.json"
  fields/
    manifest.json
    global.json
    layouts/
      home.json
      default.json
```

## manifest.json

- `schema_version`: must be `1`
- `global`: `{ "file": "global.json", "label": "…" }` (paths relative to the `fields/` directory when the manifest lives under `fields/`)
- `layouts` (optional): list of `{ "id", "label", "file", optional "template" }`
  - `template` maps to **page settings → template** (`default`, `landing`, `full_width`, …). When omitted, the layout `id` is used. Omit `layouts` or use `[]` when you only bind fields to specific pages.
- `pages` (optional): list of bindings **only for matching CMS pages**, each with:
  - `id`, `label`, `file` (same as layouts)
  - At least one matcher: `page_id` (int), `page_ids` (int[]), `slug`, or `slugs`
  - Optional `layout`: front-end layout key exposed as `$flex_theme_content()['page']['layout']` (defaults to binding `id`)
  - Optional `merge`: `true` — start from the template layout for this page’s template, then overlay sections from `file` (same section `id` is replaced)

**Resolution order** for a page in admin and on the public site: if a `pages[]` entry matches the page **id** or **slug**, its definition is used (with optional merge); otherwise the entry in `layouts[]` for the page’s template is used.

## Sections and fields

Each `global.json` / `layouts/*.json` file contains:

```json
{
  "sections": [
    {
      "id": "hero",
      "label": "Hero",
      "order": 10,
      "description": "optional",
      "fields": [
        { "id": "title", "type": "text", "label": "Заглавие", "maxLength": 200, "description": "Кратък hint в админа под етикета.", "layout": "half" }
      ]
    }
  ]
}
```

### Field types (v1)

| Type | Stored value |
|------|----------------|
| `text`, `textarea`, `url`, `email` | string |
| `checkbox` | boolean |
| `number` | number or null |
| `media`, `page_link` | integer id or null |
| `repeater` | list of objects (nested fields, max depth 2) |

Repeater: optional `maxItems` (1–100, default 50).

Optional `layout`: `half` (two columns in admin) or `full` (one row). Default: `textarea` / `repeater` / `media` / `page_link` → full width; `text`, `url`, `email`, `number` → half width (pairs such as label + URL).

IDs must match `^[a-z][a-z0-9_-]{0,63}$`.

Validation is implemented in `Flex\ThemeContent\ThemeContentSchemaValidator`.

## Admin

1. Install and activate **`flex/theme-content`**.
2. **Settings → Сайт / Theme content** — global sections from `global.json`.
3. **Страници → Действия → Съдържание на шаблона** — `/pages/{id}/theme-content` with fields from a matching `pages[]` binding or from the layout for the page template.

Storage keys:

- Global: `theme-content:global`
- Per page: `theme-content:page:{id}` → `{ "source", "binding_id", "layout", "template", "sections" }` (`source` is `page` or `template`)

## Front-end (PHP theme)

The active theme render context includes a callable **`$flex_theme_content`** (Twig: `flex_theme_content()`):

```php
$content = $flex_theme_content();
$heroTitle = $content['page']['sections']['hero']['title'] ?? '';
$email = $content['global']['sections']['contact']['email'] ?? '';
```

Escape all output in the theme. Values are read-only.

Reference theme: `themes/kriskata-corporate` with `content_schema` and sample `fields/`.

## Requirements

- Plugin permissions: `admin.ui`, `storage.documents`, `theme.extensions`, `routes.admin`
- `theme.json` key `content_schema` points at the manifest path (relative to the theme root)
