# Release и production workflow

## Build

Преди platform package build изпълнете backend проверките и production frontend build:

```bash
docker compose exec app composer check
npm --prefix resources/admin run check
docker compose exec app bin/flex platform:build --version=0.1.0
```

Release builder-ът използва allowlist за runtime корените и отделен allowlist за `public/`. Пакетът включва готовите hashed assets и Vite manifest, но изключва tests, frontend source, `node_modules`, вложени `.git`, media/runtime данни и development tooling. Липсващ production manifest прекратява build-а.

Всеки ZIP съдържа `manifest.json` с platform версия, PHP изискване, compatibility constraint, migration flag и SHA-256 за всеки payload файл. До ZIP файла се създава checksum sidecar. Production releases трябва да се подписват; installer-ът валидира checksum, manifest, signature и compatibility преди промяна на файлове.

## Deployment

1. Насочете web root към `public/`.
2. Осигурете PHP 8.3+, MySQL 8.0+ и необходимите PHP extensions.
3. Дайте write права само на `storage/`, `public/media/`, `plugins/` и `themes/`.
4. За чиста инсталация отворете `/install`; installer-ът създава `storage/.env` и `storage/installed.json`.
5. Не инсталирайте Node.js или Composer на production хоста — необходимите assets и dependencies са в release пакета.

`storage/.env`, uploads и extension-owned данни не се заменят от platform update. Деактивиране на extension не премахва таблици; това е позволено само при изрично uninstall действие и неговите versioned migrations.
