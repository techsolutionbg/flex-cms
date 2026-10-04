# Release и production workflow

GitHub съдържа комитнатия source code; Actions не се използват за release publishing. От Windows 11 изградете и публикувайте директно към update хостинга:

```powershell
Copy-Item .publish.env.example .publish.env
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish_update.ps1 `
    -TargetVersion 0.1.43 -ReleaseNotes "Описание на промените"
```

Преди публикуване попълнете `.publish.env`, уверете се, че промените са комитнати, Docker контейнерите работят и SSH alias-ът може да пише в update директорията. ZIP пакетът и checksum-ът се качват преди подписания каталог.

## Build

Преди platform package build изпълнете backend проверките и production frontend build:

```bash
docker compose exec app composer check
npm --prefix resources/admin run check
npm --prefix resources/admin-react run build:installer
docker compose exec app php bin/flex platform:build --target-version=0.1.43
```

Release builder-ът използва allowlist за runtime корените и отделен allowlist за `public/`. Пакетът включва готовите hashed assets и Vite manifest, но изключва tests, frontend source, `node_modules`, вложени `.git`, media/runtime данни и development tooling. Липсващ production manifest прекратява build-а.

Всеки ZIP съдържа `manifest.json` с platform версия, PHP изискване, compatibility constraint, migration flag и SHA-256 за всеки payload файл. До ZIP файла се създава checksum sidecar. Production releases трябва да се подписват; installer-ът валидира checksum, manifest, signature и compatibility преди промяна на файлове.

## Deployment

1. Насочете web root към `public/`.
2. Осигурете PHP 8.3+, MySQL 8.0+ или MariaDB 10.4+ и необходимите PHP extensions.
3. Дайте write права само на `storage/`, `public/media/`, `plugins/` и `themes/`.
4. За чиста инсталация отворете `/install`; installer-ът създава `storage/.env` и `storage/installed.json`.
5. Не инсталирайте Node.js или Composer на production хоста — необходимите assets и dependencies са в release пакета.

За XAMPP използвайте версия с PHP 8.3+ и MariaDB 10.4+. Ако платформата е в `C:\xampp\htdocs\flex-cms`, добавете VirtualHost към `C:\xampp\apache\conf\extra\httpd-vhosts.conf`:

```apache
<VirtualHost *:80>
    ServerName flex-cms.test
    DocumentRoot "C:/xampp/htdocs/flex-cms/public"
    <Directory "C:/xampp/htdocs/flex-cms/public">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Включете `mod_rewrite`, рестартирайте Apache и добавете `127.0.0.1 flex-cms.test` във файла `C:\Windows\System32\drivers\etc\hosts`. След това отворете `http://flex-cms.test/install`. За хостинг насочете домейна към същата `public/` папка, включете SSL и създайте празната база и потребител с пълни права върху тази база в контролния панел преди инсталацията. Документният корен на домейна трябва да сочи само към `public/`, за да останат `storage/`, `vendor/`, `src/` и конфигурационните файлове извън уеб достъпа.

`storage/.env`, uploads и extension-owned данни не се заменят от platform update. Деактивиране на extension не премахва таблици; това е позволено само при изрично uninstall действие и неговите versioned migrations.
