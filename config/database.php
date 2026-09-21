<?php

declare(strict_types=1);

return [
    'default' => $_ENV['DB_CONNECTION'] ?? 'mysql',
    'connections' => [
        'mysql' => [
            'driver' => 'mysql',
            'host' => $_ENV['DB_HOST'] ?? '127.0.0.1',
            'port' => (int) ($_ENV['DB_PORT'] ?? 3306),
            'database' => $_ENV['DB_DATABASE'] ?? 'flex_cms',
            'username' => $_ENV['DB_USERNAME'] ?? 'flex_cms',
            'password' => $_ENV['DB_PASSWORD'] ?? '',
            'unix_socket' => $_ENV['DB_SOCKET'] ?? '',
            'charset' => $_ENV['DB_CHARSET'] ?? 'utf8mb4',
            'collation' => $_ENV['DB_COLLATION'] ?? 'utf8mb4_unicode_ci',
            'prefix' => $_ENV['DB_PREFIX'] ?? '',
            'prefix_indexes' => true,
            'strict' => filter_var($_ENV['DB_STRICT'] ?? true, FILTER_VALIDATE_BOOL),
            'engine' => null,
            'options' => [
                PDO::ATTR_TIMEOUT => (int) ($_ENV['DB_TIMEOUT'] ?? 5),
                PDO::ATTR_PERSISTENT => filter_var($_ENV['DB_PERSISTENT'] ?? false, FILTER_VALIDATE_BOOL),
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ],
        ],
    ],
];
