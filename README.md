# Flex CMS

Flex CMS е платформа за бързо създаване и управление на сайтове, предназначена да работи на стандартен споделен хостинг с PHP и MySQL. Системата ще използва собствено модулно ядро и внимателно подбрани самостоятелни библиотеки, без зависимост от цялостна работна рамка.

> Проектът е в етап на планиране. Описаните по-долу изисквания и зависимости определят началната техническа посока и могат да бъдат прецизирани преди първата стабилна версия.

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
