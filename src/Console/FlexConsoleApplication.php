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
use Flex\Console\Command\CreateFirstSuperAdminCommand;
use Flex\Console\Command\DatabaseStatusCommand;
use Flex\Console\Command\PlatformBuildCommand;
use Flex\Console\Command\PlatformHistoryCommand;
use Flex\Console\Command\PlatformInspectCommand;
use Flex\Console\Command\PlatformInstallCommand;
use Flex\Console\Command\PlatformRemoteUpdateCommand;
use Flex\Console\Command\PlatformRecoverCommand;
use Flex\Console\Command\PlatformRollbackCommand;
use Flex\Console\Command\PlatformSignManifestCommand;
use Flex\Console\Command\PlatformVersionCommand;
use Flex\Console\Command\UpdateKeygenCommand;
use Flex\Console\Command\UpdateProcessCommand;
use Flex\Console\Command\UpdateQueueCommand;
use Flex\Console\Command\UpdateSignManifestCommand;
use Flex\Console\Command\UpdateStatusCommand;
use Flex\Console\Command\PluginActivateCommand;
use Flex\Console\Command\PluginDeactivateCommand;
use Flex\Console\Command\PluginInstallCommand;
use Flex\Console\Command\PluginListCommand;
use Flex\Console\Command\PluginUninstallCommand;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Database\DatabaseManager;
use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginRegistry;
use Flex\Updates\Platform\PlatformHistory;
use Flex\Updates\Platform\PlatformPackageBuilder;
use Flex\Updates\Platform\PlatformPackageInspector;
use Flex\Updates\Platform\PlatformRollback;
use Flex\Updates\Platform\PlatformUpdateRecovery;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Updates\Remote\RemotePlatformUpdater;
use Flex\Updates\Jobs\UpdateJobProcessor;
use Flex\Updates\Jobs\UpdateJobStore;
use Flex\Users\UserRepository;
use Flex\Users\UserService;
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
        DatabaseManager $database,
        UserRepository $users,
        UserService $userService,
        PlatformUpdateRecovery $updateRecovery,
        PlatformHistory $updateHistory,
        PlatformRollback $platformRollback,
        PlatformPackageBuilder $platformPackageBuilder,
        RemotePlatformUpdater $remotePlatformUpdater,
        UpdateJobProcessor $updateJobProcessor,
        UpdateJobStore $updateJobStore,
        PluginManager $pluginManager,
        PluginRegistry $pluginRegistry,
    ) {
        parent::__construct('Flex CMS', $registry->current()->value);

        $this->addCommands([
            new ConfigShowCommand($configuration, $redactor),
            new ConfigValidateCommand($configuration, $environmentValidator),
            new ConfigCacheCommand($configurationCache),
            new ConfigClearCommand($configurationCache),
            new DatabaseStatusCommand($database),
            new CreateFirstSuperAdminCommand($users, $userService),
            new PlatformVersionCommand($registry),
            new PlatformInspectCommand($inspector),
            new PlatformInstallCommand($installer, $configuration->bool('extensions.updates.require_checksum')),
            new PlatformRemoteUpdateCommand($remotePlatformUpdater),
            new PlatformRecoverCommand($updateRecovery),
            new PlatformHistoryCommand($updateHistory),
            new PlatformRollbackCommand($platformRollback),
            new PlatformSignManifestCommand(),
            new UpdateKeygenCommand(),
            new UpdateSignManifestCommand(),
            new UpdateQueueCommand($updateJobStore),
            new UpdateProcessCommand($updateJobProcessor),
            new UpdateStatusCommand($updateJobStore),
            new PlatformBuildCommand($platformPackageBuilder),
            new PluginListCommand($pluginRegistry),
            new PluginInstallCommand($pluginManager),
            new PluginActivateCommand($pluginManager),
            new PluginDeactivateCommand($pluginManager),
            new PluginUninstallCommand($pluginManager),
        ]);
    }
}
