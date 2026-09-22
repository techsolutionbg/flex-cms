# Dependency policy

## PHP runtime dependencies

Actively used: Composer Semver (version constraints), Guzzle (update health checks), Eloquent (database and models), League Route (HTTP routing), Monolog (logging), Nyholm PSR-7 (HTTP messages), PHP-DI (composition), Phinx (install/update migrations), Symfony Console (CLI), Twig (views), and phpdotenv (environment loading).

Reserved for the next existing roadmap modules: HTML Purifier (page content sanitization), Flysystem (media storage), Symfony Mailer (notifications), Symfony Translation (localization), and PSR Event Dispatcher (plugin lifecycle events). These packages stay explicit rather than being reintroduced ad hoc. A reserved package must be removed if its owning module is dropped.

Development-only packages are PHPUnit, PHPStan, and PHP CS Fixer. Production installation is always verified with `composer install --no-dev --optimize-autoloader`.

## Frontend runtime dependencies

React, React DOM, Base UI, class-variance-authority, `cn`, and Lucide are shipped into the compiled admin bundle.

## Frontend build dependencies

Vite, TypeScript, Tailwind, shadcn CLI, font source files, animation CSS, ESLint, Prettier, type packages, and their plugins are build/development tooling. They never ship as `node_modules`; only Vite output under `public/build` is deployed.

Dependency versions are locked by `composer.lock` and `resources/admin/package-lock.json`. Both lock files must change in the same commit as dependency classification or version changes.
