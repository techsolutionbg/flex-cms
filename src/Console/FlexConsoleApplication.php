<?php

declare(strict_types=1);

namespace Flex\Console;

use Flex\Console\Command\PlatformInstallCommand;
use Flex\Console\Command\PlatformInspectCommand;
use Flex\Console\Command\PlatformVersionCommand;
use Flex\Updates\Platform\PhinxPlatformMigrationRunner;
use Flex\Updates\Platform\PlatformPackageInspector;
use Flex\Updates\Platform\PlatformVersionInstaller;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Symfony\Component\Console\Application;

final class FlexConsoleApplication extends Application
{
    public function __construct(string $basePath, bool $requireChecksum, int $maximumUncompressedBytes)
    {
        $registry = new PlatformVersionRegistry($basePath);
        $inspector = new PlatformPackageInspector($maximumUncompressedBytes);
        $installer = new PlatformVersionInstaller(
            basePath: $basePath,
            inspector: $inspector,
            versions: $registry,
            migrationRunner: new PhinxPlatformMigrationRunner($basePath),
        );

        parent::__construct('Flex CMS', $registry->current()->value);

        $this->addCommands([
            new PlatformVersionCommand($registry),
            new PlatformInspectCommand($inspector),
            new PlatformInstallCommand($installer, $requireChecksum),
        ]);
    }
}
