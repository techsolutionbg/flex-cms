<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Composer\Semver\Semver;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Extensions\PluginRegistry;
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
        private readonly PluginRegistry $plugins,
    ) {}

    /** @param null|callable(string): void $onProgress */
    public function update(bool $dryRun = false, ?string $targetVersion = null, ?callable $onProgress = null): RemotePlatformUpdateResult
    {
        if ($onProgress !== null) $onProgress('resolving');
        $current = $this->versions->current();
        $release = $this->resolveRelease($targetVersion, $current);
        if ($release === null) {
            throw new RemoteCatalogException(sprintf('No compatible %s platform update is available for %s.', $this->catalog->channel(), $current->value));
        }
        $this->assertPluginCompatibility($release->version);

        if ($onProgress !== null) $onProgress('downloading');
        $path = $this->downloader->download($release);
        try {
            if ($onProgress !== null) $onProgress('verifying');
            $result = $this->installer->install($path, new PlatformInstallOptions(
                expectedChecksum: $release->checksum,
                allowDowngrade: version_compare($release->version->value, $current->value, '<'),
                dryRun: $dryRun,
                requireChecksum: $this->configuration->bool('extensions.updates.require_checksum'),
            ));

            return new RemotePlatformUpdateResult($release, $result);
        } finally {
            @unlink($path);
        }
    }

    public function resolveRelease(?string $targetVersion = null, ?PlatformVersion $current = null): ?RemoteReleaseManifest
    {
        $current ??= $this->versions->current();
        $catalog = $this->catalog->platformCatalog();
        $channel = $this->catalog->channel();
        if ($targetVersion === null || $targetVersion === '') {
            return self::selectLatest($catalog, $current, $channel);
        }

        foreach ($catalog->releases as $release) {
            if ($release->package === 'flex-cms'
                && $release->channel->value === $channel
                && $release->version->value === $targetVersion
                && Semver::satisfies(PHP_VERSION, $release->minimumPhp)
                && Semver::satisfies($current->value, $release->compatibleFrom)) {
                return $release;
            }
        }

        throw new RemoteCatalogException(sprintf('Релийзът %s не е наличен или не е съвместим с текущата платформа.', $targetVersion));
    }

    /** @return list<array{plugin: string, name: string, required: string}> */
    public function pluginCompatibilityIssues(PlatformVersion $target): array
    {
        $issues = [];
        foreach ($this->plugins->all() as $plugin) {
            $manifest = $plugin->getAttribute('manifest');
            $minimum = is_array($manifest) && is_string($manifest['minimum_platform_version'] ?? null) ? trim($manifest['minimum_platform_version']) : '';
            if ($minimum !== '' && version_compare($target->value, $minimum, '<')) {
                $issues[] = ['plugin' => (string) $plugin->getAttribute('id'), 'name' => (string) ($plugin->getAttribute('name') ?: $plugin->getAttribute('id')), 'required' => $minimum];
            }
        }

        return $issues;
    }

    private function assertPluginCompatibility(PlatformVersion $target): void
    {
        $issues = $this->pluginCompatibilityIssues($target);
        if ($issues === []) {
            return;
        }

        $details = array_map(static fn(array $issue): string => sprintf('%s (изисква %s или по-нова)', $issue['name'], $issue['required']), $issues);
        throw new RemoteCatalogException(sprintf('Релийзът %s е блокиран от инсталирани плъгини: %s.', $target->value, implode(', ', $details)));
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
