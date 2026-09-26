# Договор за автоматични обновявания

Този документ описва първата версия на договора между Flex CMS и distribution сървъра `https://updates.flex-cms.com`.

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
  "download_url": "https://updates.flex-cms.com/platform/releases/1.1.0/flex-cms-1.1.0.zip",
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
UPDATE_SERVER_URL=https://updates.flex-cms.com
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
