<?php

declare(strict_types=1);

namespace Flex\Configuration;

use Dotenv\Dotenv;

final class EnvironmentLoader
{
    public function load(string $basePath): void
    {
        $runtimeFile = $basePath . '/storage/.env';
        if (is_file($runtimeFile) && !is_readable($runtimeFile)) {
            throw new \Flex\Configuration\Exception\ConfigurationException('The runtime configuration storage/.env is not readable by this process. Check the updater user and shared group permissions.');
        }
        // The installer writes the authoritative runtime configuration here.
        // Use mutable loading so deployment defaults cannot override it later.
        Dotenv::createMutable($basePath . '/storage')->safeLoad();
    }
}
