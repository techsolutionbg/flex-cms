<?php

declare(strict_types=1);

return [
    'driver' => $_ENV['SESSION_DRIVER'] ?? 'file',
    'name' => $_ENV['SESSION_NAME'] ?? 'flex_cms_session',
    'lifetime' => (int) ($_ENV['SESSION_LIFETIME'] ?? 120),
    'path' => $_ENV['SESSION_PATH'] ?? '/',
    'domain' => ($_ENV['SESSION_DOMAIN'] ?? '') ?: null,
    'secure' => filter_var($_ENV['SESSION_SECURE_COOKIE'] ?? false, FILTER_VALIDATE_BOOL),
    'http_only' => filter_var($_ENV['SESSION_HTTP_ONLY'] ?? true, FILTER_VALIDATE_BOOL),
    'same_site' => $_ENV['SESSION_SAME_SITE'] ?? 'lax',
    'csrf_token_lifetime' => (int) ($_ENV['CSRF_TOKEN_LIFETIME'] ?? 7200),
];
