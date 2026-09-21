<?php

declare(strict_types=1);

return [
    'driver' => $_ENV['CACHE_DRIVER'] ?? 'file',
    'prefix' => $_ENV['CACHE_PREFIX'] ?? 'flex_cms',
    'ttl' => (int) ($_ENV['CACHE_TTL'] ?? 3600),
    'path' => dirname(__DIR__) . '/storage/cache',
];
