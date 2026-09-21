<?php

declare(strict_types=1);

return [
    'channel' => $_ENV['LOG_CHANNEL'] ?? 'single',
    'level' => $_ENV['LOG_LEVEL'] ?? 'warning',
    'max_files' => (int) ($_ENV['LOG_MAX_FILES'] ?? 14),
    'path' => dirname(__DIR__) . '/storage/logs/flex-cms.log',
];
