<?php

declare(strict_types=1);

return [
    'driver' => $_ENV['DB_CONNECTION'] ?? 'mysql',
    'host' => $_ENV['DB_HOST'] ?? '127.0.0.1',
    'port' => (int) ($_ENV['DB_PORT'] ?? 3306),
    'database' => $_ENV['DB_DATABASE'] ?? 'flex_cms',
    'username' => $_ENV['DB_USERNAME'] ?? 'flex_cms',
    'password' => $_ENV['DB_PASSWORD'] ?? '',
    'charset' => $_ENV['DB_CHARSET'] ?? 'utf8mb4',
    'collation' => $_ENV['DB_COLLATION'] ?? 'utf8mb4_unicode_ci',
    'prefix' => $_ENV['DB_PREFIX'] ?? '',
    'strict' => filter_var($_ENV['DB_STRICT'] ?? true, FILTER_VALIDATE_BOOL),
];
