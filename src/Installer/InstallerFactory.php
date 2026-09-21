<?php

declare(strict_types=1);

namespace Flex\Installer;

use Flex\Installer\Http\InstallerApplication;
use Flex\Installer\Http\InstallerRenderer;
use Flex\Updates\Platform\PlatformVersionRegistry;

final class InstallerFactory
{
    public function create(string $basePath): InstallerApplication
    {
        $state = new InstallationState($basePath);
        $requirements = new RequirementsChecker($basePath);
        $database = new DatabaseProbe();

        return new InstallerApplication(
            $state,
            $requirements,
            new WebInstaller(
                $basePath,
                $state,
                $requirements,
                $database,
                new EnvironmentFileWriter($basePath),
                new InstallerMigrationRunner($basePath),
                new AdministratorCreator($database),
                new PlatformVersionRegistry($basePath),
            ),
            new InstallerRenderer(),
        );
    }
}
