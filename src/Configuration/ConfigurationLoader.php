<?php

declare(strict_types=1);

namespace Flex\Configuration;

use Flex\Configuration\Exception\ConfigurationException;

final class ConfigurationLoader
{
    public function load(string $basePath, bool $useCache): ConfigurationRepository
    {
        $cachePath = $basePath . '/storage/cache/config.php';
        if ($useCache && is_file($cachePath)) {
            return new ConfigurationRepository($this->requireConfiguration($cachePath));
        }

        $files = glob($basePath . '/config/*.php');
        if ($files === false) {
            throw new ConfigurationException('The configuration directory cannot be read.');
        }
        sort($files, SORT_STRING);

        $configuration = [];
        foreach ($files as $file) {
            $name = pathinfo($file, PATHINFO_FILENAME);
            if (preg_match('/^[a-z][a-z0-9_-]*$/', $name) !== 1) {
                throw new ConfigurationException(sprintf('Invalid configuration filename "%s".', basename($file)));
            }
            $configuration[$name] = $this->requireConfiguration($file);
        }

        return new ConfigurationRepository($configuration);
    }

    /** @return array<string, mixed> */
    private function requireConfiguration(string $path): array
    {
        $configuration = (static fn(string $file): mixed => require $file)($path);
        if (!is_array($configuration)) {
            throw new ConfigurationException(sprintf('Configuration file "%s" must return an array.', $path));
        }

        return $configuration;
    }
}
