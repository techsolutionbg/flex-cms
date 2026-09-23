<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

final readonly class PluginContext
{
    /** @param array<string, mixed> $manifest */
    public function __construct(
        public string $id,
        public string $version,
        public string $path,
        public array $manifest,
    ) {}
}
