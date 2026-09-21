<?php

declare(strict_types=1);

return [
    'plugins_path' => $_ENV['PLUGINS_PATH'] ?? 'plugins',
    'themes_path' => $_ENV['THEMES_PATH'] ?? 'themes',
    'updates' => [
        'channel' => $_ENV['UPDATE_CHANNEL'] ?? 'stable',
        'enabled' => filter_var($_ENV['UPDATE_CHECK_ENABLED'] ?? true, FILTER_VALIDATE_BOOL),
        'server_url' => $_ENV['UPDATE_SERVER_URL'] ?? '',
        'require_checksum' => filter_var($_ENV['UPDATE_REQUIRE_CHECKSUM'] ?? true, FILTER_VALIDATE_BOOL),
        'require_signature' => filter_var($_ENV['UPDATE_REQUIRE_SIGNATURE'] ?? true, FILTER_VALIDATE_BOOL),
        'signing_public_key' => $_ENV['UPDATE_SIGNING_PUBLIC_KEY'] ?? '',
        'healthcheck_url' => $_ENV['UPDATE_HEALTHCHECK_URL'] ?? 'http://127.0.0.1/health',
        'max_uncompressed_mb' => (int) ($_ENV['UPDATE_MAX_UNCOMPRESSED_MB'] ?? 256),
    ],
];
