<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

final readonly class InspectedPlatformPackage
{
    public function __construct(
        public string $path,
        public string $checksum,
        public PlatformPackageManifest $manifest,
        public int $uncompressedBytes,
    ) {
    }
}
