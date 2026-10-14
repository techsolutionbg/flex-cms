# Admin Translation Editor

## Objective and acceptance criteria

Super administrators can open Translation management in Profile Settings, choose any registered admin locale, inspect its namespace-grouped English-keyed catalog, edit translations in the existing Monaco editor, and save them. Saved text overrides apply throughout the admin panel, including registered theme and plugin namespaces, survive reloads, and do not affect the public site. Built-in locale files remain the fallback/source catalogs.

## Design

- Frontend: Profile Settings and `resources/admin-react/src/lib/admin-i18n.ts`.
- Editor: existing `CodeEditor` (Monaco) in JSON mode.
- Persistence: one JSON value in the existing `settings` table, keyed as `admin.translations.overrides`.
- API: super-administrator-only `GET` and `PUT /api/admin/translations`, with CSRF protection on writes.
- Catalog format: `{ "locale": { "namespace": { "English source": "translation" } } }`.
- English bundled strings and each locale's bundled strings are the fallback when there is no saved override.

## Validation and verification

The API validates locale identifiers, namespace/key/value types, string lengths, and total catalog size. The editor rejects invalid JSON before saving. Verify with the existing admin React typecheck/build and API tests when the user requests verification; otherwise inspect the diff and preserve existing project changes.

## Boundaries

- Always restrict global translation writes to super administrators and apply translations only to admin UI.
- Do not rewrite packaged locale files when saving edits.
- Do not change public-site locale behavior.
