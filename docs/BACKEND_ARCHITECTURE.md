# Backend module boundaries

Flex CMS uses capability-oriented PSR-4 namespaces. New code must belong to one of these boundaries instead of a generic helpers or services directory.

| Boundary | Namespaces | Responsibility |
|---|---|---|
| Core | `Flex\\`, `Flex\\Providers` | Bootstrap, application lifecycle and provider composition |
| Shared API | `Flex\\Contracts` | Cross-module contracts only; extension-facing contracts are versioned separately |
| Configuration | `Flex\\Configuration` | Environment loading, validation, immutable configuration and project paths |
| Container | `Flex\\Container` | DI construction, provider discovery and compilation |
| Database | `Flex\\Database` | Connections, migrations and transaction infrastructure |
| HTTP | `Flex\\Http`, `Flex\\Session` | Kernel, routing, middleware, responses, views and sessions |
| Security | `Flex\\Auth`, `Flex\\Users` | Authentication, authorization, CSRF and user identity |
| Updates | `Flex\\Updates` | Package inspection, signing, installation, rollback and recovery |
| Installer | `Flex\\Installer` | Pre-application installation workflow only |
| Console | `Flex\\Console` | CLI commands and console composition |

## Dependency rules

- Modules may depend on `Contracts`, configuration values and stable shared infrastructure.
- HTTP controllers orchestrate use cases; domain and update services must not render HTML or depend on templates.
- Installer code remains usable before the main container and database are configured.
- Configuration files contain values and class lists only; they do not construct services.
- Providers are the composition root. Runtime classes must not read the container.
- Cross-module dependencies use contracts when multiple implementations or extension replacement is supported.
- `Shared` is a policy boundary, not a dumping-ground namespace. Value objects stay with their owning module.
