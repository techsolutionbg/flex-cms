<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Updates\Platform\PlatformInstallResult;

final readonly class RemotePlatformUpdateResult
{
    public function __construct(
        public RemoteReleaseManifest $release,
        public PlatformInstallResult $installation,
    ) {}
}
