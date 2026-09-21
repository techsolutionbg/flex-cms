<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;

final readonly class PlatformPackageInspectorFactory
{
    public function __construct(
        private ConfigRepositoryInterface $configuration,
    ) {
    }

    public function create(): PlatformPackageInspector
    {
        $megabytes = max(1, $this->configuration->int('extensions.updates.max_uncompressed_mb'));

        return new PlatformPackageInspector($megabytes * 1024 * 1024);
    }
}
