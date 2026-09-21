<?php

declare(strict_types=1);

use Flex\Providers\CoreServiceProvider;

return [
    'compile' => filter_var($_ENV['APP_CONTAINER_COMPILE'] ?? false, FILTER_VALIDATE_BOOL),
    'providers' => [
        CoreServiceProvider::class,
    ],
];
