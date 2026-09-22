<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Updates\Exception\PlatformUpdateException;

final readonly class PlatformVersionRegistry
{
    public function __construct(
        private string $basePath,
    ) {}

    public function current(): PlatformVersion
    {
        $manifestPath = $this->basePath . '/platform.json';
        $contents = @file_get_contents($manifestPath);

        if ($contents === false) {
            throw new PlatformUpdateException('The platform.json file is missing or unreadable.');
        }

        try {
            $manifest = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new PlatformUpdateException('The platform.json file contains invalid JSON.', 0, $exception);
        }

        if (!is_array($manifest) || ($manifest['name'] ?? null) !== 'flex-cms' || !is_string($manifest['version'] ?? null)) {
            throw new PlatformUpdateException('The platform.json file is not a valid Flex CMS version manifest.');
        }

        return new PlatformVersion($manifest['version']);
    }
}
