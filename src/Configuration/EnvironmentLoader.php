<?php

declare(strict_types=1);

namespace Flex\Configuration;

use Dotenv\Dotenv;

final class EnvironmentLoader
{
    public function load(string $basePath): void
    {
        Dotenv::createImmutable($basePath)->safeLoad();
    }
}
