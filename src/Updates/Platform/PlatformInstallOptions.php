<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

final readonly class PlatformInstallOptions
{
    public function __construct(
        public ?string $expectedChecksum = null,
        public bool $allowDowngrade = false,
        public bool $dryRun = false,
        public bool $requireChecksum = true,
    ) {
    }
}
