# Flex CMS

Flex CMS е платформа за бързо създаване и управление на сайтове, предназначена да работи на стандартен споделен хостинг с PHP и MySQL. Системата ще използва собствено модулно ядро и внимателно подбрани самостоятелни библиотеки, без зависимост от цялостна работна рамка.

> Проектът е в ранен етап на разработка. Описаните по-долу изисквания и зависимости определят техническата посока и могат да бъдат прецизирани преди първата стабилна версия.

## Стартиране за разработка

Необходими са Docker и Docker Compose. Локални PHP, Composer и MySQL не са задължителни.

```bash
cp .env.example .env
docker compose up --build
```

След успешното стартиране:

- приложението е достъпно на `http://localhost:8080`;
- health endpoint-ът е на `http://localhost:8080/health`;
- phpMyAdmin е достъпен на `http://localhost:8081`;
- MySQL е достъпен от хост машината на порт `33060`.

Полезни команди:

```bash
docker compose exec app composer test
docker compose exec app composer analyse
docker compose exec app vendor/bin/phinx status
docker compose down
```

Конфигурация и диагностика:

```bash
docker compose exec app bin/flex config:validate
docker compose exec app bin/flex config:show
docker compose exec app bin/flex config:cache
docker compose exec app bin/flex config:clear
```

Портовете могат да се променят чрез `APP_PORT`, `PMA_FORWARD_PORT` и `DB_FORWARD_PORT` в `.env`.

phpMyAdmin е част само от локалната Docker среда и не е production зависимост на Flex CMS. За вход се използват `DB_USERNAME` и `DB_PASSWORD` от `.env`.

## Основни възможности

Първата версия на Flex CMS трябва да включва:

- потребители, роли и права;
- страници, ревизии и статуси на публикуване;
- категории на страниците;
- медийна библиотека;
- системни настройки;
- теми;
- плъгини;
- миграции на базата данни;
- управление на версиите и обновявания от административния панел;
- журнал на важните административни действия;
- web инсталатор за среди без SSH и Composer.

Темите и плъгините ще имат собствен жизнен цикъл, версии и миграции. Те ще могат да създават и премахват таблици чрез контролирания migration слой на Flex CMS.

## Архитектура

Flex CMS ще бъде **модулен монолит** със собствено ядро. Външните библиотеки ще решават конкретни инфраструктурни задачи, но няма да определят публичното API на платформата.

Основни архитектурни правила:

- Core не зависи от конкретна тема или плъгин.
- Темите и плъгините използват публични Flex contracts и registries.
- Външните библиотеки се скриват зад Flex интерфейси, когато могат да засегнат публичното API.
- Неактивен плъгин не изпълнява application код.
- Деактивиране и деинсталиране са отделни операции.
- Деактивирането запазва данните на разширението.
- Премахването на таблици и данни изисква изрично деинсталиране и потвърждение.
- Production инсталацията не изисква Node.js, Composer, SSH, Redis или постоянно работещ queue process.

## Configuration и service container

И HTTP, и CLI входната точка използват един bootstrap процес. Той зарежда `.env`, валидира задължителните environment стойности, събира файловете от `config/` и създава PSR-11 container чрез PHP-DI.

Конфигурацията се достъпва през `Flex\\Contracts\\Configuration\\ConfigRepositoryInterface` с dot notation, например `app.name` и `database.connections.mysql.host`. Application кодът не трябва да чете директно `$_ENV`, `getenv()` или конфигурационни PHP файлове.

Основни правила:

- `.env` е локален и не се commit-ва; `.env.example` е договорът за наличните променливи;
- secrets се маскират от `config:show`;
- `config:validate` проверява типовете и задължителните production стойности;
- `config:cache` създава `storage/cache/config.php`, а `config:clear` го премахва;
- cached конфигурация се използва само при `APP_CONFIG_CACHE=true`;
- PHP-DI compilation се активира с `APP_CONTAINER_COMPILE=true` и записва във versioned поддиректория на `storage/cache/container/`;
- writable runtime директориите остават извън web root, с изключение на публичната медийна директория.

Услугите се групират в providers, които имплементират `Flex\\Contracts\\Container\\ServiceProviderInterface`. Нов provider се добавя в `config/container.php`: `definitions()` връща PHP-DI дефинициите, а `boot()` се изпълнява след построяването на container-а. Теми и плъгини няма да редактират този файл директно; техните providers ще се добавят по-късно през контролиран extension registry.

Compiled container cache key-ят включва resolved конфигурацията, `platform.json` и `composer.lock`. Промяна на platform версия, providers, конфигурация или Composer dependencies създава нов compiled container и не позволява зареждане на несъвместим стар cache.

## Database Manager

`Flex\\Database\\DatabaseManager` управлява Eloquent connections и се стартира от отделен `DatabaseServiceProvider`. Връзката остава lazy: bootstrap-ът регистрира connection конфигурацията и Eloquent model resolver-а, но реална MySQL връзка се отваря едва при първата заявка.

Manager-ът предоставя:

- именувани database connections и избор на default connection;
- достъп до Eloquent connection и schema builder;
- транзакции с конфигурируем брой повторни опити при concurrency конфликт;
- `disconnect()` и `reconnect()` за long-running процеси;
- безопасна проверка на връзката чрез `database:status`;
- резултат с име на връзката, база, версия на сървъра и latency.

```bash
docker compose exec app bin/flex database:status
```

Database паролата никога не се показва от диагностичната команда. Production runtime поддържа MySQL; SQLite се използва само за изолирани unit тестове на инфраструктурния слой.

## Web Installer

Когато липсват едновременно `.env` и `storage/installed.json`, HTTP entry point-ът пренасочва към `/install`. Installer-ът работи преди нормалния application bootstrap, така че може да стартира и при все още липсваща database конфигурация.

Процесът включва:

1. проверка на PHP 8.3+, 64-bit runtime и задължителните PHP extensions;
2. проверка на writable директориите и възможността за създаване на `.env`;
3. валидиране на URL, locale, timezone, MySQL и administrator данните;
4. проверка за MySQL 8.0+ с generic грешка, която не разкрива credentials;
5. атомарно създаване на `.env` с генериран 256-bit `APP_KEY` и права `0600`;
6. изпълнение на началните Phinx миграции;
7. създаване на първия `super_admin` потребител с `password_hash()`;
8. записване на `storage/installed.json`, което заключва installer-а.

Installer формата използва CSRF token, `SameSite=Strict`/HTTP-only session cookie, CSP, frame protection, non-cacheable responses и process lock срещу паралелна инсталация. Подадените database и administrator пароли не се връщат в HTML при грешка. Съществуващ `.env` никога не се презаписва.

Първоначалната миграция създава таблиците `users` и `settings`; Phinx управлява собствената таблица `flex_migrations`. При production deployment `.env` не трябва да присъства в release архива — той се създава от Web Installer-а.

## Минимални изисквания към хостинга

### Сървър

- Apache, Nginx или LiteSpeed;
- HTTPS;
- възможност за URL rewriting;
- възможност PHP процесът да записва в определените writable директории;
- възможност за изходящи HTTPS заявки, когато се използва автоматично обновяване.

### PHP

- PHP **8.3 или по-нова версия**;
- 64-bit PHP;
- `memory_limit` минимум 128 MB, препоръчително 256 MB;
- `upload_max_filesize` и `post_max_size`, съобразени с максималния размер на медийните файлове и extension пакетите.

Задължителни PHP разширения:

- `ctype`;
- `curl`;
- `dom`;
- `fileinfo`;
- `filter`;
- `hash`;
- `json`;
- `mbstring`;
- `openssl`;
- `pcre`;
- `pdo`;
- `pdo_mysql`;
- `session`;
- `tokenizer`;
- `xml`;
- `zip`.

Необходимо е поне едно разширение за обработка на изображения:

- `gd`; или
- `imagick`.

Препоръчително разширение:

- `intl` — локализация, форматиране и Unicode операции.

Web инсталаторът ще проверява версията на PHP, разширенията, MySQL връзката, ограниченията за качване и правата за запис, преди да започне инсталацията.

### MySQL

- MySQL **8.0 или по-нова версия**;
- storage engine: InnoDB;
- character set: `utf8mb4`;
- подходяща `utf8mb4` collation според версията на MySQL;
- потребител с права за `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `INDEX` и `DROP` в базата на Flex CMS.

MariaDB не се приема автоматично за еквивалент на MySQL. Поддръжка за MariaDB може да бъде добавена като отделна, изрично тествана платформа.

## Runtime зависимости

Предвидени са следните Composer пакети:

| Предназначение | Пакет |
| --- | --- |
| ORM и Query Builder | `illuminate/database` |
| Миграции | `robmorgan/phinx` |
| Routing | `league/route` |
| PSR-7 HTTP съобщения | `nyholm/psr7` |
| Създаване на ServerRequest от PHP globals | `nyholm/psr7-server` |
| Dependency Injection | `php-di/php-di` |
| Шаблони | `twig/twig` |
| Логове | `monolog/monolog` |
| Файлова абстракция | `league/flysystem` |
| HTTP клиент | `guzzlehttp/guzzle` |
| Semantic Versioning | `composer/semver` |
| Console команди | `symfony/console` |
| Email | `symfony/mailer` |
| HTML sanitization | `ezyang/htmlpurifier` |

Допълнителни PSR contracts могат да бъдат включени изрично:

- `psr/container`;
- `psr/event-dispatcher`;
- `psr/http-factory`;
- `psr/http-message`;
- `psr/http-server-handler`;
- `psr/http-server-middleware`;
- `psr/log`;
- `psr/simple-cache`.

Версиите на пакетите ще бъдат фиксирани при създаването на `composer.json` и трябва да са съвместими с определения минимум PHP 8.3.

## Development зависимости

Предвиденият инструментариум за разработка включва:

| Предназначение | Инструмент |
| --- | --- |
| Unit и integration тестове | PHPUnit |
| Статичен анализ | PHPStan |
| Coding style | PHP_CodeSniffer или PHP CS Fixer |
| Mutation testing | Infection, на по-късен етап |
| Управление на PHP зависимости | Composer 2 |
| Компилиране на frontend assets | Node.js LTS само в development/CI |

Node.js и Composer няма да бъдат необходими на production хостинга. Release архивът ще съдържа инсталираните production зависимости и предварително компилираните CSS и JavaScript файлове.

## Frontend и административен панел

Административният панел ще бъде server-rendered приложение:

- Twig templates;
- semantic HTML;
- CSS, компилиран предварително;
- TypeScript или JavaScript за интерактивните компоненти;
- progressive enhancement;
- `fetch` за действия, които имат полза от асинхронно изпълнение.

За първата версия не се предвижда задължителен SPA framework. Това намалява сложността и подобрява съвместимостта със споделен хостинг.

## HTTP и routing

HTTP слоят ще използва PSR-7 и PSR-15. `league/route` ще отговаря за разпознаване на маршрути, route groups и route middleware.

Типичният request pipeline ще бъде:

```text
public/index.php
  -> bootstrap
  -> error handling
  -> trusted proxies
  -> session
  -> CSRF protection
  -> authentication
  -> locale
  -> router
  -> route middleware
  -> controller
  -> PSR-7 response
  -> response emitter
```

Плъгините ще регистрират маршрути чрез Flex `RouteRegistry`, а не чрез пряка зависимост към router библиотеката.

### Application Kernel

HTTP runtime-ът е реализиран като PSR-15 `Flex\\Http\\ApplicationKernel`. `public/index.php` запазва Web Installer проверката преди normal bootstrap, след което `Flex\\Application` създава PSR-7 request от PHP globals, подава го към kernel-а и изпраща получения PSR-7 response чрез SAPI emitter.

Глобалният middleware pipeline се конфигурира в `config/http.php` и по подразбиране изпълнява:

1. request ID генериране или валидиране;
2. security headers, включително върху error responses;
3. централизирано exception handling и безопасни JSON/HTML error responses;
4. trusted host validation;
5. maintenance mode;
6. League Router dispatch и route middleware;
7. controller.

Маршрутите се регистрират през `Flex\\Contracts\\Http\\RouteRegistryInterface`. Registry-то валидира пътищата и уникалните имена и се заключва при построяване на router-а. Така Core, а по-късно темите и плъгините, не зависят пряко от League Route. Controllers връщат PSR-7 responses чрез `Flex\\Contracts\\Http\\ResponseFactoryInterface`.

Core маршрутите на този етап са:

- `GET /` — application readiness response;
- `GET /health` — lightweight liveness response, достъпен и в maintenance mode.

Непознатите маршрути и неподдържаните HTTP методи връщат съответно `404` и `405`. За `/api/*` или при `Accept: application/json` грешките са JSON; в останалите случаи са минимален HTML. Production `500` responses никога не разкриват exception съобщения.

## Users и Authentication

Authentication слоят използва native PHP sessions зад `Flex\\Contracts\\Session\\SessionInterface` и публичния `Flex\\Contracts\\Auth\\AuthenticationInterface`. Паролите се съхраняват само чрез `password_hash()` и се проверяват с `password_verify()`; при промяна на препоръчания PHP algorithm hash-ът се обновява автоматично при успешен вход.

Security правила:

- session ID се регенерира при успешен login и session-ът се инвалидира при logout;
- cookie настройките идват от `config/session.php` и включват HTTP-only, SameSite и optional Secure/Domain;
- всички state-changing auth/user routes са защитени с CSRF token;
- API token-ът се подава чрез `X-CSRF-Token`, а HTML формите използват `_token`;
- login грешките са generic и не разкриват дали email адресът съществува;
- пет неуспешни опита за една email/IP комбинация блокират следващите опити за 15 минути;
- disabled потребители не могат да се вписват и активна session се отхвърля при следваща заявка;
- users API изисква `super_admin`;
- текущият потребител не може да изтрие профила си, да отнеме собствената си роля или да се деактивира;
- последният активен `super_admin` не може да бъде деактивиран, понижен или изтрит.

Налични маршрути:

| Метод | Път | Предназначение |
| --- | --- | --- |
| `GET` | `/login` | HTML login форма |
| `POST` | `/login` | HTML session login |
| `GET` | `/api/auth/csrf` | Създаване/получаване на CSRF token |
| `POST` | `/api/auth/login` | JSON session login |
| `GET` | `/api/auth/me` | Текущ потребител и CSRF token |
| `POST` | `/api/auth/logout` | Logout и session invalidation |
| `GET` | `/api/users` | Списък на потребителите |
| `POST` | `/api/users` | Създаване на потребител |
| `PATCH/PUT` | `/api/users/{id}` | Редактиране на потребител |
| `DELETE` | `/api/users/{id}` | Изтриване на потребител |

`/health` остава независим от sessions и database authentication, за да може да служи като надежден container liveness endpoint.

## База данни и модели

Eloquent ще се използва самостоятелно чрез `illuminate/database` за:

- модели и релации;
- query builder;
- транзакции;
- casts;
- pagination основа;
- database events, когато са необходими.

Публичните contracts за теми и плъгини не трябва да връщат Eloquent модели, освен когато това е изрично част от стабилното Flex API. За стабилните граници ще се използват интерфейси и DTO обекти.

Сложните или критични за производителността заявки могат да използват Query Builder или параметризиран SQL.

## Миграции

Phinx ще бъде изпълняван зад собствен Flex `MigrationManager`. Core, всяка тема и всеки плъгин ще имат отделна директория с миграции.

Пример:

```text
database/migrations/
plugins/acme/blog/migrations/
themes/acme/default/migrations/
```

Централният migration registry трябва да съхранява поне:

- тип на разширението;
- уникално ID на разширението;
- ID на миграцията;
- checksum на файла;
- batch;
- версия на разширението;
- дата и час на изпълнение.

Миграциите се изпълняват при инсталиране и обновяване. Rollback или destructive migration не трябва да се стартира автоматично без предварителна проверка и подходящ recovery механизъм.

## Теми и плъгини

Всяка тема и всеки плъгин ще съдържа манифест с минимум:

```json
{
  "id": "acme.blog",
  "name": "Blog",
  "type": "plugin",
  "version": "1.0.0",
  "requires": {
    "flex": ">=1.0.0 <2.0.0",
    "php": ">=8.3"
  }
}
```

Extension manager-ът ще поддържа следните операции:

- install;
- activate;
- deactivate;
- update;
- uninstall.

Плъгините няма да могат да променят root `composer.json` или общата `vendor/` директория по време на инсталация. Това предотвратява конфликти между зависимостите на Core и отделните плъгини. Външни библиотеки в plugin пакет трябва да бъдат предварително пакетирани и изолирани с префиксирани namespaces.

## Версии и обновявания

Flex CMS, темите и плъгините ще използват Semantic Versioning.

Процесът на обновяване трябва да включва:

1. изтегляне или качване на пакет;
2. проверка на checksum и цифров подпис;
3. проверка на PHP, Flex и dependency съвместимостта;
4. проверка на правата за запис и свободното дисково пространство;
5. препоръка или създаване на backup;
6. maintenance mode;
7. разопаковане в staging директория;
8. изпълнение на миграциите;
9. атомарно активиране, когато средата го позволява;
10. изчистване на кеша и health check;
11. възстановяване на предишния код при неуспех.

Когато PHP няма права да променя application файловете, системата трябва да предлага ръчно обновяване чрез ZIP пакет.

### Инсталиране на platform версии

Началната имплементация предоставя Core installer и CLI команди:

```bash
docker compose exec app bin/flex platform:version
docker compose exec app bin/flex platform:inspect /path/to/flex-cms.zip --checksum=SHA256
docker compose exec app bin/flex platform:install /path/to/flex-cms.zip --checksum=SHA256 --dry-run
docker compose exec app bin/flex platform:install /path/to/flex-cms.zip --checksum=SHA256
```

`UPDATE_REQUIRE_CHECKSUM=true` изисква предварително известен SHA-256 checksum. Това е безопасната настройка по подразбиране. Ограничението за разархивирания пакет се задава чрез `UPDATE_MAX_UNCOMPRESSED_MB`.

Platform пакетът е ZIP архив със следната структура:

```text
flex-cms-1.1.0.zip
├── manifest.json
└── payload/
    ├── platform.json
    ├── src/
    ├── public/
    └── vendor/
```

Примерен `manifest.json`:

```json
{
  "schema": 1,
  "package": "flex-cms",
  "version": "1.1.0",
  "minimum_php": ">=8.3",
  "compatible_from": ">=1.0.0 <1.1.0",
  "files": {
    "platform.json": "SHA256_OF_FILE",
    "src/Application.php": "SHA256_OF_FILE"
  },
  "remove": [
    "src/ObsoleteClass.php"
  ],
  "run_migrations": true
}
```

Всеки файл в `payload/` трябва да присъства в `files` с точен SHA-256 checksum. Пакетът винаги трябва да съдържа `platform.json`, чиято версия съвпада с версията в manifest-а.

Инсталаторът:

- блокира absolute paths, `..`, символни връзки и непознати ZIP entries;
- не позволява промяна на `.env`, `.git`, `storage`, `plugins`, `themes` и `public/media`;
- проверява PHP и current-version ограниченията;
- не позволява downgrade без `--allow-downgrade`;
- използва lock срещу паралелни обновявания;
- включва maintenance mode;
- създава backup в `storage/backups/platform`;
- записва история в `storage/updates/history.jsonl`;
- възстановява файловете при неуспех.

При `run_migrations=true` се изпълняват Phinx миграциите след активиране на файловете. File rollback-ът е автоматичен, но database миграциите трябва да са проектирани като безопасни forward migrations; връщането на файловете не може универсално да върне вече commit-ната промяна на схемата.

## Writable директории

Очаква се web server процесът да има права за запис само там, където са необходими:

```text
storage/cache/
storage/logs/
storage/sessions/
storage/tmp/
public/media/
plugins/
themes/
```

Точният layout може да бъде променен при реализацията на updater-а. Конфигурационните файлове, secrets и `vendor/` не трябва да са публично достъпни.

## Предложена структура на проекта

```text
flex-cms/
├── app/
│   ├── Admin/
│   └── Site/
├── bootstrap/
├── config/
├── contracts/
├── core/
│   ├── Auth/
│   ├── Database/
│   ├── Extensions/
│   ├── Http/
│   ├── Media/
│   ├── Pages/
│   ├── Settings/
│   └── Updates/
├── database/
│   ├── migrations/
│   └── seeds/
├── plugins/
├── public/
│   └── index.php
├── resources/
│   ├── assets/
│   └── views/
├── storage/
├── themes/
├── vendor/
└── composer.json
```

## Production пакет

Официалният release ще се разпространява като готов ZIP архив, съдържащ:

- Flex CMS Core;
- `vendor/` с production зависимостите;
- компилирани frontend assets;
- web installer;
- начална тема;
- migration файловете;
- checksum и информация за версията.

Инсталацията на стандартен хостинг трябва да изисква само:

1. качване и разархивиране на пакета;
2. създаване на MySQL база и потребител;
3. отваряне на адреса на сайта;
4. завършване на web инсталатора.

## Следващи стъпки

Преди започване на имплементацията трябва да бъдат уточнени:

1. стабилните Core contracts;
2. manifest схемата за теми и плъгини;
3. lifecycle-ът на разширенията;
4. структурата и политиката за миграции;
5. threat model-ът за инсталация и обновяване;
6. минималната схема на базата данни;
7. структурата на първия release пакет;
8. поддръжката или изключването на MariaDB.
