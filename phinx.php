<?php

declare(strict_types=1);

use Dotenv\Dotenv;

if (is_file(__DIR__ . '/.env')) {
    Dotenv::createImmutable(__DIR__)->safeLoad();
}

return [
    'paths' => [
        'migrations' => '%%PHINX_CONFIG_DIR%%/database/migrations',
        'seeds' => '%%PHINX_CONFIG_DIR%%/database/seeds',
    ],
    'environments' => [
        'default_migration_table' => 'flex_migrations',
        'default_environment' => 'default',
        'default' => [
            'adapter' => 'mysql',
            'host' => $_ENV['DB_HOST'] ?? '127.0.0.1',
            'name' => $_ENV['DB_DATABASE'] ?? 'flex_cms',
            'user' => $_ENV['DB_USERNAME'] ?? 'flex_cms',
            'pass' => $_ENV['DB_PASSWORD'] ?? '',
            'port' => (int) ($_ENV['DB_PORT'] ?? 3306),
            'charset' => 'utf8mb4',
        ],
    ],
    'version_order' => 'creation',
];
