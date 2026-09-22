<?php

declare(strict_types=1);

namespace Flex\Configuration;

use Flex\Configuration\Exception\ConfigurationException;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;

final readonly class ConfigurationCache
{
    public function __construct(
        private string $basePath,
        private ConfigRepositoryInterface $configuration,
    ) {}

    public function path(): string
    {
        return $this->basePath . '/storage/cache/config.php';
    }

    public function write(): string
    {
        $path = $this->path();
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new ConfigurationException('The configuration cache directory cannot be created.');
        }

        $contents = "<?php\n\ndeclare(strict_types=1);\n\nreturn " . var_export($this->configuration->all(), true) . ";\n";
        $temporary = $path . '.tmp-' . bin2hex(random_bytes(4));
        if (file_put_contents($temporary, $contents, LOCK_EX) === false || !rename($temporary, $path)) {
            @unlink($temporary);
            throw new ConfigurationException('The configuration cache cannot be written.');
        }

        return $path;
    }

    public function clear(): bool
    {
        $path = $this->path();

        return !is_file($path) || unlink($path);
    }
}
