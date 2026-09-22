<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

final readonly class PlatformPackageBuildOptions
{
    /** @param list<string> $requiredExtensions */
    public function __construct(
        public ?string $version = null,
        public ?string $compatibleFrom = null,
        public string $minimumPhp = '>=8.3',
        public bool $runMigrations = false,
        public ?string $privateKeyPath = null,
        public ?string $keyId = null,
        public ?string $outputPath = null,
        public array $requiredExtensions = ['pdo_mysql', 'mbstring', 'curl', 'dom', 'xml'],
    ) {}
}
