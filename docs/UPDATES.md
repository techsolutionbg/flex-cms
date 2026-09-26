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

В тази стъпка е дефиниран договорът и неговата валидация. Реалното сваляне, подписване/проверка на remote catalog и инсталиране ще бъдат реализирани в следващите стъпки.
