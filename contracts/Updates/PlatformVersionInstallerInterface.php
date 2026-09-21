<?php

declare(strict_types=1);

namespace Flex\Contracts\Updates;

use Flex\Updates\Platform\PlatformInstallOptions;
use Flex\Updates\Platform\PlatformInstallResult;

interface PlatformVersionInstallerInterface
{
    public function install(string $packagePath, PlatformInstallOptions $options): PlatformInstallResult;
}
