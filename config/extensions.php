<?php

declare(strict_types=1);

return [
    'plugins_path' => $_ENV['PLUGINS_PATH'] ?? 'plugins',
    'themes_path' => $_ENV['THEMES_PATH'] ?? 'themes',
    'updates' => [
        'channel' => $_ENV['UPDATE_CHANNEL'] ?? 'stable',
        'enabled' => filter_var($_ENV['UPDATE_CHECK_ENABLED'] ?? true, FILTER_VALIDATE_BOOL),
        'server_url' => $_ENV['UPDATE_SERVER_URL'] ?? 'https://updates-flex-cms.kriskata.com',
        'require_checksum' => filter_var($_ENV['UPDATE_REQUIRE_CHECKSUM'] ?? true, FILTER_VALIDATE_BOOL),
        'require_signature' => filter_var($_ENV['UPDATE_REQUIRE_SIGNATURE'] ?? true, FILTER_VALIDATE_BOOL),
        // Keep the canonical release trust key as a safe default so a fresh
        // installation can verify platform, theme, and plugin manifests even
        // when its runtime environment file omits this optional override.
        'signing_public_key' => $_ENV['UPDATE_SIGNING_PUBLIC_KEY'] ?? 'f8jqe8uwSmPX8JKDKAxlTzAMYSnVcAuUHHRsUMd+5dQ=',
        // This is process-specific: the worker container reaches the web container by name.
        'healthcheck_url' => getenv('UPDATE_HEALTHCHECK_URL') ?: ($_ENV['UPDATE_HEALTHCHECK_URL'] ?? 'http://127.0.0.1/health'),
        'max_uncompressed_mb' => (int) ($_ENV['UPDATE_MAX_UNCOMPRESSED_MB'] ?? 256),
        'max_download_mb' => (int) ($_ENV['UPDATE_MAX_DOWNLOAD_MB'] ?? 256),
    ],
];
