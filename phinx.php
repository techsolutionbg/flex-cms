<?php

declare(strict_types=1);

use Dotenv\Dotenv;

$environmentFile = is_file(__DIR__ . '/.env') ? __DIR__ : __DIR__ . '/storage';
if (is_file($environmentFile . '/.env')) {
    Dotenv::createImmutable($environmentFile)->safeLoad();
}

$environmentValue = static function (string $name, mixed $default = null): mixed {
    $value = $_ENV[$name] ?? $_SERVER[$name] ?? getenv($name);

    return $value === false || $value === null ? $default : $value;
};

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
            'host' => $environmentValue('DB_HOST', '127.0.0.1'),
            'name' => $environmentValue('DB_DATABASE', 'flex_cms'),
            'user' => $environmentValue('DB_USERNAME', 'flex_cms'),
            'pass' => $environmentValue('DB_PASSWORD', ''),
            'port' => (int) $environmentValue('DB_PORT', 3306),
            'charset' => 'utf8mb4',
        ],
    ],
    'version_order' => 'creation',
];
