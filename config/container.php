<?php

declare(strict_types=1);

use Flex\Providers\AuthServiceProvider;
use Flex\Providers\CoreServiceProvider;
use Flex\Providers\DatabaseServiceProvider;
use Flex\Providers\HttpServiceProvider;

return [
    'compile' => filter_var($_ENV['APP_CONTAINER_COMPILE'] ?? false, FILTER_VALIDATE_BOOL),
    'providers' => [
        CoreServiceProvider::class,
        DatabaseServiceProvider::class,
        HttpServiceProvider::class,
        AuthServiceProvider::class,
    ],
];
