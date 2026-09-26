<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Composer\Semver\Semver;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Updates\PlatformVersionInstallerInterface;
use Flex\Updates\Exception\RemoteCatalogException;
use Flex\Updates\Platform\PlatformInstallOptions;
use Flex\Updates\Platform\PlatformVersion;
use Flex\Updates\Platform\PlatformVersionRegistry;

final class RemotePlatformUpdater
{
    public function __construct(
        private readonly ConfigRepositoryInterface $configuration,
        private readonly RemoteCatalogClient $catalog,
        private readonly RemotePackageDownloader $downloader,
        private readonly PlatformVersionInstallerInterface $installer,
        private readonly PlatformVersionRegistry $versions,
    ) {}

    public function update(bool $dryRun = false): RemotePlatformUpdateResult
    {
        $current = $this->versions->current();
        $release = self::selectLatest($this->catalog->platformCatalog(), $current, $this->configuration->string('extensions.updates.channel'));
        if ($release === null) {
            throw new RemoteCatalogException(sprintf('No compatible %s platform update is available for %s.', $this->configuration->string('extensions.updates.channel'), $current->value));
        }

        $path = $this->downloader->download($release);
        try {
            $result = $this->installer->install($path, new PlatformInstallOptions(
                expectedChecksum: $release->checksum,
                dryRun: $dryRun,
                requireChecksum: $this->configuration->bool('extensions.updates.require_checksum'),
            ));

            return new RemotePlatformUpdateResult($release, $result);
        } finally {
            @unlink($path);
        }
    }

    public static function selectLatest(RemoteCatalog $catalog, PlatformVersion $current, string $channel): ?RemoteReleaseManifest
    {
        $candidates = array_filter($catalog->releases, function (RemoteReleaseManifest $release) use ($channel, $current): bool {
            return $release->package === 'flex-cms'
                && $release->channel->value === $channel
                && version_compare($release->version->value, $current->value, '>')
                && Semver::satisfies(PHP_VERSION, $release->minimumPhp)
                && Semver::satisfies($current->value, $release->compatibleFrom);
        });
        usort($candidates, static fn(RemoteReleaseManifest $left, RemoteReleaseManifest $right): int => version_compare($right->version->value, $left->version->value));

        return $candidates[0] ?? null;
    }
}
