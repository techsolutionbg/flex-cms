<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Composer\Semver\Semver;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginManifest;
use Flex\Extensions\PluginRegistry;
use Flex\Updates\Exception\InvalidPlatformPackage;
use Flex\Updates\Exception\RemoteCatalogException;

final class RemotePluginUpdater
{
    public function __construct(
        private readonly RemoteCatalogClient $catalog,
        private readonly RemotePackageDownloader $downloader,
        private readonly PluginRegistry $plugins,
        private readonly PluginManager $manager,
        private readonly ConfigRepositoryInterface $configuration,
        private readonly PluginUpdateHistory $history,
        private readonly string $basePath,
    ) {}

    /** @return array{plugin_id: string, from: string, to: string, active: bool, history_id: string} */
    public function update(string $pluginId): array
    {
        $plugin = $this->plugins->find($pluginId);
        if ($plugin === null) {
            throw new RemoteCatalogException(sprintf('Plugin "%s" is not installed.', $pluginId));
        }
        $manifest = $this->catalog->pluginManifest($pluginId);
        $current = new \Flex\Updates\Platform\PlatformVersion((string) $plugin->getAttribute('version'));
        $channel = $this->configuration->string('extensions.updates.channel');
        $candidates = array_filter($manifest->releases, static fn(RemoteReleaseManifest $release): bool => $release->package === $pluginId && $release->channel->value === $channel && version_compare($release->version->value, $current->value, '>') && Semver::satisfies(PHP_VERSION, $release->minimumPhp) && Semver::satisfies($current->value, $release->compatibleFrom));
        usort($candidates, static fn(RemoteReleaseManifest $left, RemoteReleaseManifest $right): int => version_compare($right->version->value, $left->version->value));
        $release = $candidates[0] ?? null;
        if ($release === null) {
            throw new RemoteCatalogException(sprintf('No compatible update is available for plugin "%s".', $pluginId));
        }
        $archive = $this->downloader->download($release);
        $stage = $this->basePath . '/storage/tmp/plugin-update-' . bin2hex(random_bytes(8));
        $active = $plugin->getAttribute('status') === PluginManager::STATUS_ACTIVE;
        $fromVersion = (string) $plugin->getAttribute('version');
        $oldPath = (string) $plugin->getAttribute('path');
        $backup = $oldPath . '.backup-' . bin2hex(random_bytes(5));
        $persistentBackup = null;
        try {
            $root = $this->extract($archive, $stage, $pluginId);
            if ($active) {
                $this->manager->deactivate($pluginId);
            }
            if (!rename($oldPath, $backup) || !rename($root, $oldPath)) {
                throw new RemoteCatalogException('The plugin update could not replace the installed files.');
            }
            $this->manager->install($pluginId);
            if ($active) {
                $this->manager->activate($pluginId);
            }
            $persistentBackup = $this->basePath . '/storage/backups/plugins/' . str_replace(['/', '\\'], '-', $pluginId) . '/' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(4));
            if (!is_dir(dirname($persistentBackup)) && !mkdir(dirname($persistentBackup), 0775, true) && !is_dir(dirname($persistentBackup))) throw new RemoteCatalogException('The plugin backup directory cannot be created.');
            if (!rename($backup, $persistentBackup)) throw new RemoteCatalogException('The plugin backup cannot be persisted.');
            $historyId = 'plugin-update-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(4));
            $this->history->append(['id' => $historyId, 'type' => 'plugin_update', 'plugin_id' => $pluginId, 'from' => $fromVersion, 'to' => $release->version->value, 'backup_path' => $persistentBackup, 'active' => $active, 'updated_at' => gmdate(DATE_ATOM)]);

            return ['plugin_id' => $pluginId, 'from' => $fromVersion, 'to' => $release->version->value, 'active' => $active, 'history_id' => $historyId];
        } catch (\Throwable $exception) {
            if (is_dir($oldPath)) {
                $this->deleteDirectory($oldPath);
            }
            if (is_dir($backup)) {
                @rename($backup, $oldPath);
            } elseif (is_string($persistentBackup) && is_dir($persistentBackup)) {
                @rename($persistentBackup, $oldPath);
            }
            if (is_dir($oldPath)) {
                if ($active) {
                    try { $this->manager->activate($pluginId); } catch (\Throwable) { }
                }
            }
            throw $exception;
        } finally {
            @unlink($archive);
            $this->deleteDirectory($stage);
        }
    }

    private function extract(string $archive, string $stage, string $pluginId): string
    {
        if (!class_exists(\ZipArchive::class)) {
            throw new InvalidPlatformPackage('The PHP ZIP extension is required for plugin updates.');
        }
        if (!mkdir($stage, 0770, true) && !is_dir($stage)) {
            throw new RemoteCatalogException('The plugin update staging directory cannot be created.');
        }
        $zip = new \ZipArchive();
        if ($zip->open($archive) !== true) {
            throw new InvalidPlatformPackage('The plugin update archive cannot be opened.');
        }
        for ($index = 0; $index < $zip->numFiles; $index++) {
            $name = $zip->getNameIndex($index);
            if (!is_string($name) || $name === '' || str_starts_with($name, '/') || preg_match('~(^|/)\.\.(?:/|$)~', $name) === 1) {
                $zip->close();
                throw new InvalidPlatformPackage('The plugin archive contains an unsafe path.');
            }
        }
        if (!$zip->extractTo($stage)) {
            $zip->close();
            throw new InvalidPlatformPackage('The plugin archive could not be extracted.');
        }
        $zip->close();
        $manifestPath = null;
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($stage, \FilesystemIterator::SKIP_DOTS)) as $file) {
            if ($file->isFile() && $file->getFilename() === 'plugin.json') {
                if ($manifestPath !== null) {
                    throw new InvalidPlatformPackage('The plugin archive must contain exactly one plugin.json.');
                }
                $manifestPath = $file->getPathname();
            }
        }
        if ($manifestPath === null || PluginManifest::fromFile($manifestPath)->id !== $pluginId) {
            throw new InvalidPlatformPackage('The plugin archive manifest does not match the requested plugin.');
        }

        return dirname($manifestPath);
    }

    private function deleteDirectory(string $path): void
    {
        if (!is_dir($path)) return;
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($path);
    }
}
