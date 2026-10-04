# Договор за автоматични обновявания

Този документ описва първата версия на договора между Flex CMS и distribution сървъра `https://updates-flex-cms.kriskata.com`.

## Канали

Поддържат се три канала:

- `stable` — production версии;
- `beta` — версии за предварително тестване;
- `dev` — development версии.

Каналът се задава чрез `UPDATE_CHANNEL`. По подразбиране е `stable`.

## Release manifest

Каталогът публикува release entries със следната структура:

```json
{
  "schema": 1,
  "package": "flex-cms",
  "type": "platform",
  "version": "1.1.0",
  "channel": "stable",
      "download_url": "https://updates-flex-cms.kriskata.com/platform/releases/1.1.0/flex-cms-1.1.0.zip",
  "checksum": "<sha256>",
  "size": 123456,
  "minimum_php": ">=8.3",
  "compatible_from": ">=1.0.0 <2.0.0",
  "published_at": "2026-09-25T12:00:00+00:00",
  "release_notes": "...",
  "signature_algorithm": "ed25519",
  "key_id": "release-2026",
  "signature": "<base64 signature>"
}
```

За плъгин `type` е `plugin`, а `package` използва `vendor/name`, например `flex/seo`.

`download_url` трябва да бъде HTTPS URL. Точната allowlist проверка на host-а ще бъде част от remote client-а в следващата стъпка.

## Версии и съвместимост

Версиите използват Semantic Versioning. `compatible_from` е Composer/Semver constraint за текущата версия на платформата. Всеки release ZIP остава непроменяем след публикуване.

Вътрешният `manifest.json` в ZIP пакета остава авторитетен за съдържанието на пакета. Release manifest-ът описва как клиентът да намери и предварително да оцени пакета.

## Rollback политика

Преди инсталация се създава backup на засегнатите файлове и базата данни, когато се изпълняват миграции. Последните успешни версии се пазят локално според retention политика. Rollback на файловете не се счита за достатъчен без стратегия за database migrations.

## Конфигурация

```dotenv
UPDATE_SERVER_URL=https://updates-flex-cms.kriskata.com
UPDATE_CHANNEL=stable
UPDATE_CHECK_ENABLED=true
UPDATE_REQUIRE_CHECKSUM=true
UPDATE_REQUIRE_SIGNATURE=true
```

В тази стъпка е дефиниран договорът и неговата валидация. Реалното сваляне и инсталиране ще бъдат реализирани в следващите стъпки.

## Подписване на release manifest

Ключова двойка се генерира локално или в CI среда:

```bash
bin/flex updates:keygen /secure/path/flex-updates.private /secure/path/flex-updates.public
```

Private key файлът трябва да остане извън Git repository и извън публичната директория на update сървъра. С него се подписва предварително подготвен unsigned manifest:

```bash
bin/flex updates:sign-manifest \
  release.json \
  signed-release.json \
  --private-key-file=/secure/path/flex-updates.private \
  --key-id=release-2026
```

Само `signed-release.json` се публикува в catalog-а. Публичният ключ се задава в production чрез `UPDATE_SIGNING_PUBLIC_KEY`.

## Catalog client

Платформата използва общ `RemoteCatalogClient` за platform и plugin каталозите. Той кешира JSON отговорите в `storage/cache/updates/` и изпраща `If-None-Match`/`If-Modified-Since`, когато update сървърът предостави съответните headers.

Клиентът приема само HTTPS update server URL. Проверяването на цифровите подписи и свалянето на ZIP artifact-ите са отделни операции и ще се извършват преди инсталация.

## Сигурно сваляне на artifact-и

`RemotePackageDownloader` приема само HTTPS URL към host-а от `UPDATE_SERVER_URL`, проверява release manifest подписа, ограничава размера чрез `UPDATE_MAX_DOWNLOAD_MB`, записва първо в `.zip.part` файл и проверява размера и SHA-256 преди финализиране.

Няма redirect следване при сваляне. Пълната ZIP структура и вътрешният package manifest се валидират от съществуващия platform package inspector непосредствено преди инсталация.

## Remote platform update

Съществуващият platform installer вече може да бъде извикан през remote catalog:

```bash
bin/flex platform:remote-update --dry-run
bin/flex platform:remote-update
```

Командата избира най-високата съвместима версия от конфигурирания канал, сваля пакета, подава го към същия installer като ръчно качен ZIP и изтрива временния файл след края на операцията. Backup, maintenance mode, migrations, health check и recovery остават в съществуващия installer pipeline.

## Shared hosting worker

За хостинг без queue server обновяването се записва във файловата опашка `storage/updates/jobs.json`. Worker-ът използва file lock и може да бъде стартиран от cPanel Cron:

```bash
php /path/to/flex-cms/bin/flex updates:process
```

Пример за периодично изпълнение на всеки 15 минути:

```cron
*/15 * * * * /usr/bin/php /path/to/flex-cms/bin/flex updates:process >/dev/null 2>&1
```

Ръчно добавяне и наблюдение на job:

```bash
bin/flex updates:queue
bin/flex updates:status
```

Remote plugin update се поставя в същата опашка с plugin ID:

```bash
bin/flex updates:queue flex/seo
```

Worker-ът сваля подписания plugin artifact от plugin catalog-а, валидира checksum-а и manifest-а, заменя файловете атомарно и извиква стандартния plugin lifecycle update. Ако плъгинът е бил активен, той се деактивира временно и се активира отново след успешна инсталация.

## Plugin rollback и recovery

След успешно remote plugin update предишната версия се съхранява в `storage/backups/plugins/`, а metadata-та се записва в `storage/updates/plugins-history.json`. При неуспех по време на замяната updater-ът възстановява предишните файлове и активния статус в рамките на същата операция.

Rollback се изпълнява от CLI с history ID:

```bash
bin/flex plugin:rollback plugin-update-20260926-abc123
```

Rollback използва същия lifecycle на плъгина и възстановява активния статус само ако той е бил активен преди обновяването. Backup-ът се пази до успешен rollback или до изрично зададена по-късна retention политика.

Ако worker остане прекъснат повече от 15 минути, следващото изпълнение автоматично връща job-а в `pending` състояние. Опашката е подходяща за един production worker и не изисква Redis или Supervisor.

## Административен интерфейс за remote обновявания

Страницата `/admin/updates` проверява remote platform каталога и показва текущата версия, update канала, наличната съвместима версия, release notes и размера на пакета. При налична версия администраторът може да постави обновяването във файловата опашка. Заявката не изпълнява инсталация в HTTP заявката; тя се обработва от `updates:process`, което е подходящо за shared hosting.

Същата страница показва последните jobs и техните статуси (`pending`, `running`, `completed`, `failed`). Ако remote каталогът е временно недостъпен, това се показва като грешка в интерфейса, без да блокира ръчния ZIP upload и rollback функционалността.

## Публикуване на platform release

Release-ът се изгражда и качва локално от Windows 11 чрез `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish_update.ps1 -TargetVersion <версия>`. Скриптът използва Docker Compose за production asset-ите и platform ZIP-а, локалния Ed25519 private key за подписване и Windows OpenSSH (`ssh`/`scp`) за качване към update хостинга. ZIP-ът и checksum-ът се качват първи; подписаният каталог се качва последен. GitHub се използва за комитнатия source code и не участва в процеса на публикуване на release. `php bin/flex platform:publish` работи само при native Windows PHP; той не може да се стартира от Linux `app` контейнера.

Настройките за публикуване се пазят в локалния, gitignored `.publish.env`, създаден от `.publish.env.example`. Signing private key-ът и SSH достъпът не се добавят в repository.

Същият catalog tool поддържа и plugin release entries чрез `--type plugin --package vendor/name`; plugin build pipeline-ът може да подаде готовия, проверен plugin ZIP към този tool, без да променя формата на remote каталога.

## Production hardening checklist

Преди production activation трябва да се потвърди:

- private signing key-ът да е локален файл извън Git repository и никога да не се качва в `updates/`;
- `updates/` да е read-only за приложението и да изпълнява само статични JSON/ZIP файлове;
- `storage/updates`, `storage/backups/plugins` и `storage/tmp` да са writable само от application user;
- cron worker-ът да е единствен активен worker за конкретната инсталация;
- `UPDATE_REQUIRE_SIGNATURE=true` и `UPDATE_REQUIRE_CHECKSUM=true` да са включени;
- първо да се тества `--dry-run`, след това реално обновяване и rollback върху backup среда;
- да има backup на базата данни преди platform update с миграции.

Кодът валидира plugin ID, managed backup path и инсталационния plugin path, за да не допуска path traversal или запис извън контролирани директории.
