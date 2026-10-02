<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Composer\Semver\Semver;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Themes\ThemeManager;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Updates\Exception\RemoteCatalogException;

final readonly class RemoteThemeInstaller
{
    public function __construct(private ThemeCatalogClient $catalog, private RemoteThemePackageDownloader $downloader, private ThemePackageInstaller $installer, private ConfigRepositoryInterface $configuration, private ThemeManager $themes, private PlatformVersionRegistry $versions) {}

    /** @return array{theme_id: string, from: string, to: string, active: bool, backup_path: string} */
    public function install(string $themeId): array
    {
        $current = array_values(array_filter($this->themes->all(), static fn(array $theme): bool => $theme['id'] === $themeId))[0] ?? null;
        if (is_array($current)) throw new RemoteCatalogException(sprintf('Темата „%s“ вече е инсталирана.', $themeId));

        $catalog = $this->catalog->manifest($themeId);
        $channel = $this->configuration->string('extensions.updates.channel');
        $candidates = array_values(array_filter($catalog->releases, fn(\Flex\Themes\ThemeReleaseManifest $release): bool => $release->package === $themeId && $release->channel->value === $channel && Semver::satisfies(PHP_VERSION, $release->minimumPhp) && Semver::satisfies($this->versions->current()->value, $release->compatibleFrom)));
        usort($candidates, static fn($a, $b): int => version_compare($b->version, $a->version));
        $release = $candidates[0] ?? null;
        if ($release === null) throw new RemoteCatalogException(sprintf('Няма съвместима версия за инсталиране на тема „%s“.', $themeId));

        $archive = $this->downloader->download($release);
        try { return $this->installer->installArchive($archive, $themeId, $release->version); } finally { @unlink($archive); }
    }

    /** @return array{theme_id: string, from: string, to: string, active: bool, backup_path: string} */
    public function update(string $themeId): array
    {
        $current = array_values(array_filter($this->themes->all(), static fn(array $theme): bool => $theme['id'] === $themeId))[0] ?? null;
        if (!is_array($current) || !$current['valid']) throw new RemoteCatalogException(sprintf('Темата „%s“ не е инсталирана или е невалидна.', $themeId));
        $catalog = $this->catalog->manifest($themeId);
        $channel = $this->configuration->string('extensions.updates.channel');
        $candidates = array_values(array_filter($catalog->releases, fn(\Flex\Themes\ThemeReleaseManifest $release): bool => $release->package === $themeId && $release->channel->value === $channel && version_compare($release->version, (string) $current['version'], '>') && Semver::satisfies(PHP_VERSION, $release->minimumPhp) && Semver::satisfies((string) $current['version'], $release->compatibleFrom)));
        usort($candidates, static fn($a, $b): int => version_compare($b->version, $a->version));
        $release = $candidates[0] ?? null;
        if ($release === null) throw new RemoteCatalogException(sprintf('Няма съвместимо обновяване за тема „%s“.', $themeId));
        $archive = $this->downloader->download($release);
        try { return $this->installer->installArchive($archive, $themeId, $release->version); } finally { @unlink($archive); }
    }
}
