# ADR-0002: Discover plugin admin translations from locale files

## Status
Accepted

## Date
2026-10-14

## Context
Plugin admin labels need translations isolated from the platform catalog. Requiring each plugin to import catalogs and register them from its JavaScript module duplicates setup code and can delay language availability until a screen loads. Plugins also need to support different sets of languages without changing the platform's built-in catalogs.

## Decision
Active plugins may place one JSON catalog per locale in `<plugin-root>/locales/<locale>.json`. The platform discovers and validates these files server-side while building the admin extension bootstrap response, keyed by the registering plugin ID. Plugin modules use the shared `host.i18n.t()` helper, which defaults to their own plugin namespace. Existing explicit registration remains supported for compatibility, but plugins do not need registration code for file-based catalogs.

The locale code in each filename follows the supported BCP 47 pattern. Catalog keys are English source strings. A missing plugin translation falls back to that plugin's English catalog and then to the source key. Admin plugin catalogs never fall back to `core`, and the platform translation editor continues to manage only `core`.

## Consequences
- Adding a language requires adding a JSON file; the locale is automatically available in the admin language picker.
- Plugin translations remain scoped to the active plugin and administrative UI.
- The bootstrap validates JSON shape, locale names and file locations, and caps each file at 256 KiB and the total response at 2 MiB.
- Plugin-owned UI strings still need to call `host.i18n.t()`; static text cannot change language automatically without using the translation helper.
- Existing modules that call `host.i18n.register()` continue to work while migrating to locale files.
