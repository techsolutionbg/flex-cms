<?php

declare(strict_types=1);

namespace Flex\Console;

use Flex\Configuration\ConfigurationCache;
use Flex\Configuration\ConfigurationRedactor;
use Flex\Configuration\EnvironmentValidator;
use Flex\Console\Command\ConfigCacheCommand;
use Flex\Console\Command\ConfigClearCommand;
use Flex\Console\Command\ConfigShowCommand;
use Flex\Console\Command\ConfigValidateCommand;
use Flex\Console\Command\PlatformInstallCommand;
use Flex\Console\Command\PlatformInspectCommand;
use Flex\Console\Command\PlatformVersionCommand;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Updates\Platform\PlatformPackageInspector;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Symfony\Component\Console\Application;

final class FlexConsoleApplication extends Application
{
    public function __construct(
        ConfigRepositoryInterface $configuration,
        PlatformVersionRegistry $registry,
        PlatformPackageInspector $inspector,
        PlatformVersionInstallerInterface $installer,
        ConfigurationCache $configurationCache,
        EnvironmentValidator $environmentValidator,
        ConfigurationRedactor $redactor,
    )
    {
        parent::__construct('Flex CMS', $registry->current()->value);

        $this->addCommands([
            new ConfigShowCommand($configuration, $redactor),
            new ConfigValidateCommand($configuration, $environmentValidator),
            new ConfigCacheCommand($configurationCache),
            new ConfigClearCommand($configurationCache),
            new PlatformVersionCommand($registry),
            new PlatformInspectCommand($inspector),
            new PlatformInstallCommand($installer, $configuration->bool('extensions.updates.require_checksum')),
        ]);
    }
}
