<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

final readonly class PlatformPackageBuildResult
{
    public function __construct(
        public string $path,
        public string $checksum,
        public string $version,
        public int $fileCount,
        public bool $signed,
    ) {
    }
}
