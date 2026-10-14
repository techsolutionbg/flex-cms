# Plugin admin translations

Platform translations and plugin translations are separate catalogs.

## Platform

The platform owns the `core` namespace in `resources/admin-react/src/lib/locales/`. The Profile → Translation management editor and `/api/admin/translations` endpoint accept only this namespace.

## Plugins

Each active plugin can add one JSON file per supported language under a `locales` folder in the plugin root. The platform discovers the files automatically when it loads `/api/admin/extensions`; no import or registration code is required.

```text
plugins/flex/example/locales/en.json
plugins/flex/example/locales/bg.json
```

Catalogs use English source text as keys:

`locales/en.json`

```json
{
  "Campaigns": "Campaigns",
  "Create campaign": "Create campaign",
  "Save changes": "Save changes"
}
```

`locales/bg.json`

```json
{
  "Campaigns": "Кампании",
  "Create campaign": "Създай кампания",
  "Save changes": "Запази промените"
}
```

In plugin modules, call `host.i18n.t("Campaigns")`; the platform automatically uses that module's plugin ID as its translation namespace. Variables can be passed as the second argument, for example `host.i18n.t("Hello, {name}", { name })`. An explicit namespace can still be passed as the second argument, with interpolation variables as the third.

Use one JSON file per supported BCP 47 locale. Any language found in an active plugin's files becomes selectable in the admin language picker. A missing translation falls back to that plugin's `en.json`, then to its English source key. Plugin catalogs are loaded for the administrative interface only; public theme output does not use the admin locale. The platform catalog and platform-managed overrides are never used as a fallback for plugin namespaces.

Locale files must contain a JSON object of string keys and string values. The platform ignores invalid locale filenames and malformed catalog files. Individual files are limited to 256 KiB and all discovered catalogs together are limited to 2 MiB per bootstrap response.

Plugin-owned page, panel, tab, search, nested-section and table-action labels use the plugin's namespace automatically. Shared platform controls continue to use the `core` translations.
