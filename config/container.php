<?php

declare(strict_types=1);

use Flex\Providers\AdminRouteServiceProvider;
use Flex\Providers\AuthRouteServiceProvider;
use Flex\Providers\AuthServiceProvider;
use Flex\Providers\CoreRouteServiceProvider;
use Flex\Providers\CoreServiceProvider;
use Flex\Providers\DatabaseServiceProvider;
use Flex\Providers\ExtensionServiceProvider;
use Flex\Providers\HttpServiceProvider;
use Flex\Providers\UpdateServiceProvider;
use Flex\Providers\UserRouteServiceProvider;

return [
    'compile' => filter_var($_ENV['APP_CONTAINER_COMPILE'] ?? false, FILTER_VALIDATE_BOOL),
    'providers' => [
        CoreServiceProvider::class,
        DatabaseServiceProvider::class,
        ExtensionServiceProvider::class,
        HttpServiceProvider::class,
        AuthServiceProvider::class,
        UpdateServiceProvider::class,
        CoreRouteServiceProvider::class,
        AuthRouteServiceProvider::class,
        AdminRouteServiceProvider::class,
        UserRouteServiceProvider::class,
    ],
];
