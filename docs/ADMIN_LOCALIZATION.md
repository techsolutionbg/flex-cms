# Admin panel languages

English (`en`) is the default and source language for the admin panel. Bulgarian (`bg`) is available as a built-in translation. The signed-in user's `admin_locale` preference changes only the admin React app; public theme rendering and public content continue to use the site's configured language.

## Core interface

Each built-in language has its own catalog file under `resources/admin-react/src/lib/locales/`. English source strings are listed in `en.ts`; Bulgarian translations use those same English keys in `bg.ts`. New interface strings should be written in English and passed to `t`:

```ts
t("Profile settings")
```

Existing core components still pass some Bulgarian strings to `t`; the i18n helper resolves those against the Bulgarian catalog during the gradual migration. New code should use English source strings so English remains the fallback and future translations have a stable key.

Use `t()` for visible labels and help text even when they come from configuration arrays, theme metadata, extension descriptors, table actions, or field schemas. Keep user-entered values such as page titles, filenames, and menu item text as data; translate the surrounding interface text instead. Interpolated strings can pass values as the third argument:

```ts
t("{count} files selected", "core", { count })
```

To add another built-in language, create a locale file such as `de.ts` with English source keys and German values, import it in `admin-i18n.ts`, and add its BCP 47 code and native label to `localeLabels`. Locale codes such as `de` and `pt-BR` are supported.

## Editing translations in the admin panel

Super administrators can open **Profile settings → Appearance → Translation management**, choose a registered language, and edit its namespace-grouped JSON catalog in the Monaco editor. English source strings are the keys. Saving stores only values that differ from the packaged catalogs in the `admin.translations.overrides` setting; those overrides survive deployments and take precedence over bundled translations. Removing an entry or restoring its packaged value clears that override. Registered theme and plugin namespaces are included when their catalogs have loaded in the admin panel. Overrides affect admin UI only, never public theme output.

## Themes and plugins

Active plugins can add admin translations as `<plugin-root>/locales/<locale>.json`. The platform discovers these catalogs automatically, registers each under that plugin's namespace, and adds discovered locales to the admin language picker. Plugin modules call `host.i18n.t("Campaigns")`; the extension host defaults to the module's plugin namespace. Explicit namespace calls and runtime catalog registration remain supported for compatibility. See [plugin admin translations](plugin-admin-translations.md) for the file format and fallback behavior. Admin locale catalogs must not be used for public-facing theme output.
