<?php

declare(strict_types=1);

return [
    'plugins_path' => $_ENV['PLUGINS_PATH'] ?? 'plugins',
    'themes_path' => $_ENV['THEMES_PATH'] ?? 'themes',
    'updates' => [
        'channel' => $_ENV['UPDATE_CHANNEL'] ?? 'stable',
        'enabled' => filter_var($_ENV['UPDATE_CHECK_ENABLED'] ?? true, FILTER_VALIDATE_BOOL),
        'server_url' => $_ENV['UPDATE_SERVER_URL'] ?? '',
    ],
];
