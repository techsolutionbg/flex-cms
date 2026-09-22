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

Source of truth е `resources/admin/src`. Използват се React, TypeScript, Vite, Tailwind CSS и shadcn/ui. Компонентите от `src/components/ui` са primitives; layout и feature компонентите не трябва да дублират техните tokens и поведение.

```bash
npm --prefix resources/admin ci
npm --prefix resources/admin run dev
npm --prefix resources/admin run typecheck
npm --prefix resources/admin run lint
npm --prefix resources/admin run test:unit
npm --prefix resources/admin run test:component
npm --prefix resources/admin run check:css
npm --prefix resources/admin run check:dead-code
npm --prefix resources/admin run build
```

Production build-ът е minified и без source maps. Development build-ът остава четим. Генерираният `public/build/admin` не е source code и се създава само чрез Vite.

Browser тестовете са в `resources/admin/tests/browser`. Те изпълняват desktop и mobile проекти срещу URL от `PLAYWRIGHT_BASE_URL`; приложението трябва да е стартирано предварително.

## Dependency policy

- PHP runtime packages са в `require`, анализаторите и тестовите инструменти — в `require-dev`.
- Browser runtime packages са в `dependencies`, build/test/style инструменти — в `devDependencies`.
- `composer audit --locked` и `npm audit --audit-level=high` са отделни проверки, защото се нуждаят от registry достъп.
- Не се commit-ват `vendor`, `node_modules`, cache директории и локални secrets.
