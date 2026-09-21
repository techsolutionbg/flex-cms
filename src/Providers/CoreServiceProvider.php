<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Application;
use Flex\Configuration\ConfigurationRedactor;
use Flex\Configuration\EnvironmentValidator;
use Flex\Console\FlexConsoleApplication;
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Updates\PlatformMigrationRunnerInterface;
use Flex\Contracts\Updates\PlatformDatabaseBackupInterface;
use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Logging\LoggerFactory;
use Flex\Updates\Platform\PhinxPlatformMigrationRunner;
use Flex\Updates\Platform\PlatformPackageInspector;
use Flex\Updates\Platform\PlatformPackageInspectorFactory;
use Flex\Updates\Platform\PlatformHealthChecker;
use Flex\Updates\Platform\PlatformPreflightChecker;
use Flex\Updates\Platform\PlatformHistory;
use Flex\Updates\Platform\PlatformRollback;
use Flex\Updates\Platform\MySqlPlatformDatabaseBackup;
use Flex\Updates\Platform\PlatformVersionInstaller;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Updates\Platform\PlatformUpdateRecovery;
use Flex\Updates\Platform\PlatformUpdateStateStore;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use function DI\autowire;
use function DI\create;
use function DI\factory;
use function DI\get;

final class CoreServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            EnvironmentValidator::class => create(),
            ConfigurationRedactor::class => create(),
            LoggerFactory::class => autowire(),
            LoggerInterface::class => factory([LoggerFactory::class, 'create']),
            PlatformVersionRegistry::class => create()->constructor(get('base_path')),
            PlatformPackageInspectorFactory::class => autowire(),
            PlatformPackageInspector::class => factory([PlatformPackageInspectorFactory::class, 'create']),
            PlatformMigrationRunnerInterface::class => create(PhinxPlatformMigrationRunner::class)
                ->constructor(get('base_path')),
            PlatformVersionInstallerInterface::class => create(PlatformVersionInstaller::class)
                ->constructor(
                    get('base_path'),
                    get(PlatformPackageInspector::class),
                    get(PlatformVersionRegistry::class),
                    get(PlatformMigrationRunnerInterface::class),
                    get(PlatformUpdateStateStore::class),
                    get(PlatformPreflightChecker::class),
                    get(PlatformHealthChecker::class),
                    get(PlatformDatabaseBackupInterface::class),
                ),
            PlatformUpdateStateStore::class => create()->constructor(get('base_path')),
            PlatformUpdateRecovery::class => create()->constructor(
                get('base_path'),
                get(PlatformUpdateStateStore::class),
                get(PlatformDatabaseBackupInterface::class),
            ),
            PlatformPreflightChecker::class => create()->constructor(get('base_path')),
            PlatformHealthChecker::class => autowire(),
            PlatformHistory::class => create()->constructor(get('base_path')),
            PlatformRollback::class => create()->constructor(
                get('base_path'),
                get(PlatformHistory::class),
                get(PlatformVersionRegistry::class),
                get(PlatformDatabaseBackupInterface::class),
            ),
            PlatformDatabaseBackupInterface::class => autowire(MySqlPlatformDatabaseBackup::class),
            Application::class => autowire(),
            FlexConsoleApplication::class => autowire(),
        ];
    }

    public function boot(ContainerInterface $container): void
    {
        $container->get(LoggerInterface::class)->debug('Flex CMS service container booted.');
    }
}
