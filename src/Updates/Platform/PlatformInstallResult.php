<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

final readonly class PlatformInstallResult
{
    public function __construct(
        public PlatformVersion $from,
        public PlatformVersion $to,
        public string $packageChecksum,
        public ?string $backupPath,
        public bool $dryRun,
    ) {
    }
}
