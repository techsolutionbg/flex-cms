<?php

declare(strict_types=1);

namespace Flex\Providers;

use function DI\autowire;
use function DI\create;
use function DI\factory;
use function DI\get;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Updates\PlatformDatabaseBackupInterface;
use Flex\Contracts\Updates\PlatformMigrationRunnerInterface;
use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Contracts\Updates\RemoteCatalogTransportInterface;
use Flex\Contracts\Updates\RemotePackageTransportInterface;
use Flex\Updates\Platform\{MySqlPlatformDatabaseBackup, PhinxPlatformMigrationRunner, PlatformHealthChecker, PlatformHistory, PlatformPackageBuilder, PlatformPackageInspector, PlatformPackageInspectorFactory, PlatformPackageUpload, PlatformPreflightChecker, PlatformRollback, PlatformUpdateRecovery, PlatformUpdateStateStore, PlatformVersionInstaller, PlatformVersionRegistry};
use Flex\Updates\Remote\{CurlRemoteCatalogTransport, CurlRemotePackageTransport, RemoteCatalogClient, RemotePackageDownloader, RemotePlatformUpdater};
use Flex\Updates\Jobs\{UpdateJobProcessor, UpdateJobStore};
use Psr\Container\ContainerInterface;

final class UpdateServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            PlatformVersionRegistry::class => create()->constructor(get('base_path')),
            RemoteCatalogTransportInterface::class => autowire(CurlRemoteCatalogTransport::class),
            RemoteCatalogClient::class => create()->constructor(get(ConfigRepositoryInterface::class), get(RemoteCatalogTransportInterface::class), get('base_path')),
            RemotePackageTransportInterface::class => autowire(CurlRemotePackageTransport::class),
            RemotePackageDownloader::class => create()->constructor(get(ConfigRepositoryInterface::class), get(RemotePackageTransportInterface::class), get('base_path')),
            RemotePlatformUpdater::class => autowire(),
            UpdateJobStore::class => create()->constructor(get('base_path')),
            UpdateJobProcessor::class => autowire(),
            PlatformPackageBuilder::class => create()->constructor(get('base_path'), get(PlatformVersionRegistry::class)),
            PlatformPackageInspectorFactory::class => autowire(), PlatformPackageInspector::class => factory([PlatformPackageInspectorFactory::class, 'create']),
            PlatformMigrationRunnerInterface::class => create(PhinxPlatformMigrationRunner::class)->constructor(get('base_path')),
            PlatformDatabaseBackupInterface::class => autowire(MySqlPlatformDatabaseBackup::class),
            PlatformUpdateStateStore::class => create()->constructor(get('base_path')), PlatformPreflightChecker::class => create()->constructor(get('base_path')), PlatformHealthChecker::class => autowire(), PlatformHistory::class => create()->constructor(get('base_path')), PlatformPackageUpload::class => create()->constructor(get('base_path')),
            PlatformVersionInstallerInterface::class => create(PlatformVersionInstaller::class)->constructor(get('base_path'), get(PlatformPackageInspector::class), get(PlatformVersionRegistry::class), get(PlatformMigrationRunnerInterface::class), get(PlatformUpdateStateStore::class), get(PlatformPreflightChecker::class), get(PlatformHealthChecker::class), get(PlatformDatabaseBackupInterface::class)),
            PlatformUpdateRecovery::class => create()->constructor(get('base_path'), get(PlatformUpdateStateStore::class), get(PlatformDatabaseBackupInterface::class)),
            PlatformRollback::class => create()->constructor(get('base_path'), get(PlatformHistory::class), get(PlatformVersionRegistry::class), get(PlatformDatabaseBackupInterface::class)),
        ];
    }
    public function boot(ContainerInterface $container): void {}
}
