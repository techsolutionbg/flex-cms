<?php

declare(strict_types=1);

namespace Flex\Configuration;

use Dotenv\Dotenv;

final class EnvironmentLoader
{
    public function load(string $basePath): void
    {
        // The installer writes the authoritative runtime configuration here.
        // Use mutable loading so deployment defaults cannot override it later.
        Dotenv::createMutable($basePath . '/storage')->safeLoad();
    }
}
