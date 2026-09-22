# Admin frontend

The admin interface is a Vite + React application using shadcn/ui with Tailwind CSS v4.

## Source boundaries

- `src/components/ui`: shadcn primitives owned by the project.
- `src/components/shared`: reusable product components when the first shared component is needed.
- `src/components/layout`: application-shell components when the PHP shell is migrated to React.
- `src/hooks`: reusable React hooks when the first hook is needed.
- `src/lib`: framework-independent frontend utilities.
- `src/styles/globals.css`: CSS entry point and Tailwind theme mapping.
- `src/styles/tokens.css`: the only source of global design tokens.
- `src/styles/admin-shell.css`: transitional PHP-rendered admin shell styles.

Do not create empty placeholder directories. Add a directory from the list above together with its first real module.

## shadcn/ui rules

- Add components from `resources/admin` with `npm exec shadcn@latest add <component>`.
- Import UI primitives through `@/components/ui/*`.
- Import `cn` and other helpers through `@/lib/*`.
- Keep application-specific components outside `components/ui`.
- Remove generated primitives that are not used by the application.

## Styling rules

- Use semantic tokens such as `background`, `foreground`, `primary`, `accent`, `muted`, `destructive`, `success`, and `info`.
- Add or change global values only in `tokens.css`; do not redeclare token sets in components or PHP views.
- Use the shared radius, elevation, motion, focus, and spacing tokens instead of local magic values when a token applies.
- Development assets are generated with `npm run build:dev`; production assets with `npm run build`.
