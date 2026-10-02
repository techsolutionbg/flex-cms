<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Composer\Semver\Semver;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Updates\Exception\RemoteCatalogException;
use Flex\Updates\Platform\PlatformVersionRegistry;

final readonly class RemotePluginInstaller
{
    public function __construct(
        private RemoteCatalogClient $catalog,
        private RemotePackageDownloader $downloader,
        private PluginPackageInstaller $installer,
        private ConfigRepositoryInterface $configuration,
        private PlatformVersionRegistry $versions,
    ) {}

    public function install(string $pluginId): string
    {
        $catalog = $this->catalog->pluginManifest($pluginId);
        $channel = $this->configuration->string('extensions.updates.channel');
        $candidates = array_values(array_filter(
            $catalog->releases,
            fn(RemoteReleaseManifest $release): bool => $release->package === $pluginId
                && $release->type === 'plugin'
                && $release->channel->value === $channel
                && Semver::satisfies(PHP_VERSION, $release->minimumPhp)
                && Semver::satisfies($this->versions->current()->value, $release->compatibleFrom),
        ));
        usort($candidates, static fn(RemoteReleaseManifest $left, RemoteReleaseManifest $right): int => version_compare($right->version->value, $left->version->value));
        $release = $candidates[0] ?? null;
        if (!$release instanceof RemoteReleaseManifest) {
            throw new RemoteCatalogException(sprintf('No compatible plugin release is available for "%s".', $pluginId));
        }

        $archive = $this->downloader->download($release);
        try {
            return $this->installer->installArchive($archive, 'catalog');
        } finally {
            @unlink($archive);
        }
    }
}
