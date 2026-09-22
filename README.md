# Flex CMS

Flex CMS е модулна CMS платформа за PHP 8.3+ и MySQL 8.0+, проектирана за стандартен хостинг. Production пакетът съдържа готовите frontend assets и Composer dependencies, затова на сървъра не са нужни Node.js, Composer, SSH, Redis или постоянен worker.

Проектът е в активна разработка. Ядрото вече включва configuration/container bootstrap, database manager, web installer, application kernel, authentication и защитен механизъм за platform update пакети.

## Бърз старт

Необходими са Docker и Docker Compose:

```bash
cp .env.example .env
docker compose up --build
```

- приложение: `http://localhost:8080`
- health check: `http://localhost:8080/health`
- phpMyAdmin: `http://localhost:8081`
- Vite dev server: `http://localhost:5173`

MySQL host-ът вътре в Docker мрежата е `mysql`, а стандартната база и потребител са `flex_cms`. Локалните стойности могат да се променят в `.env`.

## Проверки

```bash
docker compose exec app composer check
npm --prefix resources/admin ci
npm --prefix resources/admin run check
```

Browser тестовете очакват работещо приложение и инсталирани Playwright браузъри:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm --prefix resources/admin run test:browser
```

## Структура

```text
bin/                 CLI entry point
config/              application и container configuration
contracts/           versioned public extension API
database/            Phinx migrations
docker/              development и production images
docs/                architecture и workflow документация
plugins/             инсталирани plugin пакети
public/              единственият web root и production assets
resources/admin/     React, TypeScript, Vite и shadcn/ui source
resources/views/     Twig и server-rendered templates
src/                 platform modules и shared infrastructure
storage/             environment, cache, logs и update runtime data
tests/               backend, architecture и integration tests
themes/              инсталирани theme пакети
```

Кодът на frontend-а не се обслужва директно. Development режимът използва Vite, а production използва единствено hashed файловете и manifest-а в `public/build/admin/`.

## Основни workflows

- Development, тестове и статичен анализ: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- Release пакет и production deployment: [docs/RELEASE.md](docs/RELEASE.md)
- Backend граници: [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md)
- Environment настройки: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
- Зависимости: [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md)
- Подробна структура: [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

## Архитектурни граници

- Core не зависи от конкретна тема или плъгин.
- Разширенията използват само versioned contracts от `contracts/Extension/V1`.
- Деактивирането запазва данните; премахването им е отделна, изрична uninstall операция.
- Application кодът получава configuration и инфраструктура през container-а.
- Контролерите координират HTTP заявки; HTML остава във view слоя.
- `storage/` и `public/media/` са runtime данни и не влизат в platform update пакета.

## Production изисквания

- PHP 8.3+, 64-bit, PDO MySQL и разширенията от `composer.json`;
- MySQL 8.0+;
- Apache, Nginx или LiteSpeed с document root към `public/`;
- HTTPS и outbound HTTPS за автоматични обновявания;
- write права за `storage/`, `public/media/`, `plugins/` и `themes/`;
- препоръчителен `memory_limit` поне 256 MB.

Никога не насочвайте document root към project root и не качвайте development `.env`, `node_modules`, тестове или frontend source в production.
