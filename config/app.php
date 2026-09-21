<?php

declare(strict_types=1);

return [
    'name' => $_ENV['APP_NAME'] ?? 'Flex CMS',
    'environment' => $_ENV['APP_ENV'] ?? 'production',
    'debug' => filter_var($_ENV['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOL),
    'url' => $_ENV['APP_URL'] ?? 'http://localhost',
    'key' => $_ENV['APP_KEY'] ?? '',
    'version' => $_ENV['APP_VERSION'] ?? '0.1.0-dev',
    'timezone' => $_ENV['APP_TIMEZONE'] ?? 'UTC',
    'locale' => $_ENV['APP_LOCALE'] ?? 'en',
    'fallback_locale' => $_ENV['APP_FALLBACK_LOCALE'] ?? 'en',
    'maintenance' => filter_var($_ENV['APP_MAINTENANCE'] ?? false, FILTER_VALIDATE_BOOL),
    'force_https' => filter_var($_ENV['FORCE_HTTPS'] ?? false, FILTER_VALIDATE_BOOL),
    'trusted_hosts' => array_values(array_filter(explode(',', $_ENV['TRUSTED_HOSTS'] ?? ''))),
    'trusted_proxies' => array_values(array_filter(explode(',', $_ENV['TRUSTED_PROXIES'] ?? ''))),
];
