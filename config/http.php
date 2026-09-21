<?php

declare(strict_types=1);

use Flex\Http\Middleware\ErrorHandlerMiddleware;
use Flex\Http\Middleware\HostValidationMiddleware;
use Flex\Http\Middleware\MaintenanceModeMiddleware;
use Flex\Http\Middleware\RequestIdMiddleware;
use Flex\Http\Middleware\SecurityHeadersMiddleware;

return [
    'middleware' => [
        RequestIdMiddleware::class,
        SecurityHeadersMiddleware::class,
        ErrorHandlerMiddleware::class,
        HostValidationMiddleware::class,
        MaintenanceModeMiddleware::class,
    ],
];
