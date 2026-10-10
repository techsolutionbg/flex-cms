# Development workflow

## Среда

Копирайте `.env.example` като `.env` и стартирайте `docker compose up --build`. PHP приложението, MySQL, phpMyAdmin и Vite frontend service са отделни процеси. PHP и Composer могат да останат изцяло в контейнера.

## Backend

```bash
docker compose exec app composer test
docker compose exec app composer analyse
docker compose exec app composer style:check
docker compose exec app composer audit
docker compose exec app composer check
```

Тестовете са организирани по capability. Малките изолирани тестове не отварят външни услуги; integration тестовете за kernel, database, installer, authentication и update пакети използват реалните adapters или временни ресурси. `tests/Architecture` пази границите между presentation, public web root и test namespaces.

## Frontend

Source of truth за единствения административен панел и инсталатора е `resources/admin-react/src`. Използват се React, TypeScript, Vite и Tailwind CSS.

```bash
npm --prefix resources/admin-react ci
npm --prefix resources/admin-react run dev
npm --prefix resources/admin-react run typecheck
npm --prefix resources/admin-react run build:admin
npm --prefix resources/admin-react run build:installer
```

Production build-овете са minified и без source maps. Admin SPA се публикува в `/admin`, а инсталаторът — на `/install`. Генерираните файлове са в `public/build/react-admin/` и `public/build/installer/`.

## Време и дати

- Сървърът работи в UTC (PHP и MySQL сесията). В базата се пише UTC; низ без зона винаги е UTC.
- Към браузъра се подава UTC, за предпочитане ISO 8601 със `Z` (`Flex\Extension\V1\Time::iso()`).
- Датите се показват само чрез модула за време (Day.js): `<DateTime>` в админа, `host.components.DateTime` в плъгините, `flex_time()` в Twig и `/assets/flex-time.js` на публичните страници. Не се използват `toLocaleString()`, Twig `|date` или рязане на низове.
- `public/assets/flex-time.js` се генерира с `npm --prefix resources/admin-react run build:time` и се commit-ва.
- Подробности: раздел „Time“ в `contracts/Extension/V1/README.md`.

## Dependency policy

- PHP runtime packages са в `require`, анализаторите и тестовите инструменти — в `require-dev`.
- Browser runtime packages са в `dependencies`, build/test/style инструменти — в `devDependencies`.
- `composer audit --locked` и `npm audit --audit-level=high` са отделни проверки, защото се нуждаят от registry достъп.
- Не се commit-ват `vendor`, `node_modules`, cache директории и локални secrets.
