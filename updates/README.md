# Distribution scaffold за `updates.flex-cms.com`

Тази директория е статичният release root на update сървъра. Тя трябва да бъде публикувана като document root на:

```text
https://updates.flex-cms.com/
```

На shared hosting не е необходим PHP runtime за тази директория. Тя съдържа само JSON metadata, ZIP artifacts и `.sha256` sidecar файлове.

## Структура

```text
updates/
├── platform/
│   ├── manifest.json
│   └── releases/
│       └── <version>/
│           ├── flex-cms-<version>.zip
│           └── flex-cms-<version>.zip.sha256
└── plugins/
    ├── index.json
    └── <vendor>/<name>/
        ├── manifest.json
        └── releases/
            └── <version>/
                ├── <vendor>-<name>-<version>.zip
                └── <vendor>-<name>-<version>.zip.sha256
```

Плъгините могат да бъдат групирани и в отделни директории по ID. `plugins/index.json` е каталогът на plugin manifest-ите, а всеки plugin manifest съдържа release entries за конкретния плъгин.

## Platform catalog

`platform/manifest.json` трябва да съдържа release entries, съвместими с `RemoteReleaseManifest`:

```json
{
  "schema": 1,
  "repository": "flex-cms",
  "type": "platform",
  "releases": [
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
  ]
}
```

## Plugin catalog

`plugins/index.json` съдържа списък от plugin manifest URL адреси:

```json
{
  "schema": 1,
  "repository": "flex-cms",
  "type": "plugin",
  "plugins": [
    {
      "id": "flex/seo",
      "manifest_url": "https://updates.flex-cms.com/plugins/flex/seo/manifest.json"
    }
  ]
}
```

Plugin manifest-ът ще използва същия release entry формат, но с `type: "plugin"` и `package: "flex/seo"`.

## Публикуване

1. Изгражда се подписан ZIP пакет от платформата или плъгина.
2. Пакетът се качва в нова versioned директория.
3. Качва се `.sha256` sidecar файл.
4. Обновява се съответният каталог.
5. Каталогът се публикува последен, след като всички артефакти са налични.

Старите директории не се преименуват и не се презаписват. Това позволява rollback и предотвратява появата на каталог, който сочи към липсващ пакет.

## Права и web server

На update хостинга са нужни само read права за web сървъра. Private signing key никога не се качва в тази директория. `.htaccess` изключва directory listing, PHP execution и достъп до deployment metadata.

Тази директория е scaffold за distribution хостинга. Следващата стъпка е да се добави tooling за подписване и генериране на тези каталози, вместо JSON файловете да се редактират ръчно.
