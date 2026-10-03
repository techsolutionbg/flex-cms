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

### Docker контейнери и портове

Основната локална Docker конфигурация стартира следните услуги. Портовете са стойностите по подразбиране и могат да се променят чрез `.env`.

| Услуга | Docker service | Host порт | Container порт | Предназначение |
| --- | --- | ---: | ---: | --- |
| Приложение | `app` | `8080` и `8088` | `80` | Основно приложение, installer и публична PHP част |
| React админ панел | `frontend-react` | `8090` | `8090` | Административен интерфейс |
| Vite dev server | `frontend` | `5173` | `5173` | Development frontend server |
| MySQL | `mysql` | `3306` | `3306` | База данни |
| phpMyAdmin | `phpmyadmin` | `8081` | `80` | Управление на MySQL през браузър |
| Mailpit SMTP | `mailpit` | `1025` | `1025` | Локално приемане на изпратени имейли |
| Mailpit Web UI | `mailpit` | `8025` | `8025` | Преглед на локалните имейли |
| Updater worker | `updater` | — | — | Обработка на queued platform updates; достъпен само вътре в Docker мрежата |

Основните адреси са:

- публична и installer част: `http://localhost:8080`
- алтернативен app порт: `http://localhost:8088`
- React административен панел: `http://localhost:8090`
- Vite dev server: `http://localhost:5173`
- phpMyAdmin: `http://localhost:8081`
- Mailpit: `http://localhost:8025`

Ако портът `8080` вече се използва, задайте например `APP_PORT=8182` в `.env`. За React панела използвайте `VITE_REACT_FORWARD_PORT`, а за MySQL — `DB_FORWARD_PORT`.

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
themes/              инсталирани theme пакети (всяка тема може да е отделен Git repository)
```

Кодът на frontend-а не се обслужва директно. Development режимът използва Vite, а production използва единствено hashed файловете и manifest-а в `public/build/admin/`.

## Основни workflows

- Development, тестове и статичен анализ: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- Release пакет и production deployment: [docs/RELEASE.md](docs/RELEASE.md)
- Backend граници: [docs/BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md)
- Environment настройки: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
- Зависимости: [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md)
- Подробна структура: [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

### Създаване на релийз

Версиите използват Semantic Versioning: `MAJOR.MINOR.PATCH`.
От корена на проекта създайте пакет с:

```bash
php flex platform:release --bump=patch   # 0.1.38 → 0.1.39
php flex platform:release --bump=minor   # 0.1.38 → 0.2.0
php flex platform:release --bump=major   # 0.1.38 → 1.0.0

# Build and publish directly to the configured update host
php flex platform:publish --bump=patch --release-notes="Описание на промените"
```

`platform:release` записва ZIP пакета и checksum файла в `releases/<version>/` спрямо корена на проекта (например `/home/kristian/tech-solution/Flex CMS/releases/`). `platform:publish` използва същия локален build, след което подписва и качва пакета и update manifest-а чрез SSH/SCP. Настройте `UPDATE_SSH_TARGET`, `UPDATE_REMOTE_ROOT`, `UPDATE_SERVER_BASE_URL` и `UPDATE_SIGNING_PRIVATE_KEY_FILE` преди публикуване. Командата се изпълнява от хост машината в корена на проекта, не от `app` контейнера, защото използва Docker Compose, npm, SSH и SCP.

Може да се използват и цифрите `--bump=1` (major), `--bump=2` (minor) и `--bump=3` (patch). Ако `--bump` и `--target-version` не са зададени, се увеличава patch версията. Не използвайте двете опции едновременно. `platform:release` само създава пакета; `platform:publish` създава и публикува релийза.

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
- write права за `storage/`, `public/media/`, `plugins/` и външната папка за теми;
- препоръчителен `memory_limit` поне 256 MB.

Никога не насочвайте document root към project root и не качвайте development `.env`, `node_modules`, тестове или frontend source в production.
