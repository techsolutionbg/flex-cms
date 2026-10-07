# Flex CMS

Flex CMS е модулна CMS платформа за PHP 8.3+ и MySQL 8.0+, проектирана за стандартен хостинг. Production пакетът съдържа готовите frontend assets и Composer dependencies, затова на сървъра не са нужни Node.js, Composer, SSH, Redis или постоянен worker.

Проектът е в активна разработка. Ядрото вече включва configuration/container bootstrap, database manager, web installer, application kernel, authentication и защитен механизъм за platform update пакети.

## Бърз старт

Необходими са Docker и Docker Compose:

```bash
cp .env.example .env
docker compose up --build
```

- сайт: `http://localhost:8090`
- административен панел: `http://localhost:8090/admin`
- инсталатор: `http://localhost:8090/install`
- health check: `http://localhost:8090/health`
- phpMyAdmin: `http://localhost:8081`


MySQL host-ът вътре в Docker мрежата е `mysql`, а стандартната база и потребител са `flex_cms`. Локалните стойности могат да се променят в `.env`.

### Docker контейнери и портове

Основната локална Docker конфигурация стартира следните услуги. Портовете са стойностите по подразбиране и могат да се променят чрез `.env`.

| Услуга | Docker service | Host порт | Container порт | Предназначение |
| --- | --- | ---: | ---: | --- |
| PHP приложение | `app` | — | `80` | Вътрешен PHP backend; достъпен през единния dev вход на 8090 |
| Единен dev вход | `frontend-react` | `8090` | `8090` | Сайт, административен панел и инсталатор; React HMR и PHP proxy |

| MySQL | `mysql` | `3306` | `3306` | База данни |
| phpMyAdmin | `phpmyadmin` | `8081` | `80` | Управление на MySQL през браузър |
| Mailpit SMTP | `mailpit` | `1025` | `1025` | Локално приемане на изпратени имейли |
| Mailpit Web UI | `mailpit` | `8025` | `8025` | Преглед на локалните имейли |
| Updater worker | `updater` | — | — | Обработка на queued platform updates; достъпен само вътре в Docker мрежата |

Основните адреси са:

- публична част: `http://localhost:8090`
- инсталатор: `http://localhost:8090/install`

- React административен панел: `http://localhost:8090/admin`
- Vite dev server: `http://localhost:5173`
- phpMyAdmin: `http://localhost:8081`
- Mailpit: `http://localhost:8025`

За единния dev порт използвайте `VITE_REACT_FORWARD_PORT`, а за MySQL — `DB_FORWARD_PORT`. PHP backend-ът няма публикуван host порт.

## Административен панел и проверки

```bash
docker compose exec app composer check
npm --prefix resources/admin-react ci
npm --prefix resources/admin-react run typecheck
npm --prefix resources/admin-react run build:admin
npm --prefix resources/admin-react run build:installer
```

React приложението в `resources/admin-react/` е единственият административен панел и се отваря на `/admin`. Инсталацията също използва React интерфейса на `/install`; след нея се отваря `/admin/login`.

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
resources/admin-react/ React административен панел и инсталатор
resources/views/     Twig и server-rendered templates
src/                 platform modules и shared infrastructure
storage/             environment, cache, logs и update runtime data
tests/               backend, architecture и integration tests
themes/              инсталирани theme пакети (всяка тема може да е отделен Git repository)
```

Кодът на frontend-а не се обслужва директно. Development режимът използва Vite, а production използва React bundles в `public/build/react-admin/` и `public/build/installer/`.

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
php flex platform:release --bump=patch   # 0.1.43 → 0.1.44
php flex platform:release --bump=minor   # 0.1.43 → 0.2.0
php flex platform:release --bump=major   # 0.1.43 → 1.0.0

# Build and publish directly to the configured update host
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish_update.ps1 `
  -TargetVersion 0.1.43 -ReleaseNotes "Описание на промените"
```

`platform:release` записва ZIP пакета и checksum файла в `releases/<version>/`. `platform:publish` изпълнява локалния PowerShell publisher, изгражда asset-ите през Docker, подписва пакета и каталога с локалния Ed25519 ключ и качва ZIP, checksum и каталога към update хостинга чрез SSH/SCP. GitHub Actions не участва в release процеса. Publisher-ът изисква чисти, комитнати platform промени; frontend източниците се изключват, а готовите React bundles се включват.

Създайте локален `.publish.env` от [.publish.env.example](.publish.env.example), задайте SSH alias/пътя до ключа и проверете, че `UPDATE_SERVER_URL` в `.env` сочи към същия update host. Publisher-ът се стартира от Windows 11 с Docker Desktop и Windows OpenSSH (`ssh`/`scp`); PHP 8.3+ с Composer зависимостите трябва да работи в `app` контейнера. Самият deploy ключ остава в Windows OpenSSH/SSH agent, а signing private key остава локален и не се commit-ва.

Може да се използват и цифрите `--bump=1` (major), `--bump=2` (minor) и `--bump=3` (patch). Ако `--bump` и `--target-version` не са зададени, се увеличава patch версията. Не използвайте двете опции едновременно. `platform:release` само създава пакета; `platform:publish` създава и публикува релийза директно към update хостинга.

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

### Optimized media previews

In DEV, generate WebP previews for existing images in bounded, resumable batches:

```sh
php -d memory_limit=512M bin/flex media:thumbnails --limit=100
php -d memory_limit=512M bin/flex media:thumbnails --after-id=100 --limit=100
```

Use the last ID printed by the previous batch. Add `--force` after changing preview size. Originals remain unchanged. Failed files are reported individually; the command returns a nonzero exit code when a file fails. PNG is retained as a fallback on servers without GD WebP support. The preview size follows Settings → Media library. Missing previews use a lightweight placeholder in the media browser until generated. Media responses support HTTP validators and versioned preview caching. No release or hosting deployment is performed by this command.
