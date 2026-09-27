<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginManifest;
use Flex\Extensions\Plugin;
use Flex\Extensions\PluginRegistry;
use Flex\Updates\Exception\InvalidPlatformPackage;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Installs plugin ZIP archives from either a local upload or the remote catalog.
 * Both sources use the same extraction and replacement rules.
 */
final readonly class PluginPackageInstaller
{
    public function __construct(
        private PluginRegistry $plugins,
        private PluginManager $manager,
        private string $basePath,
    ) {}

    public function installUpload(UploadedFileInterface $upload): string
    {
        if ($upload->getError() !== UPLOAD_ERR_OK) {
            throw new InvalidPlatformPackage('Please select a readable plugin ZIP package.');
        }

        $directory = $this->basePath . '/storage/tmp';
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new InvalidPlatformPackage('The plugin upload staging directory cannot be created.');
        }
        $archive = $directory . '/plugin-upload-' . bin2hex(random_bytes(8)) . '.zip';
        try {
            $upload->moveTo($archive);
            return $this->installArchive($archive, 'local');
        } finally {
            @unlink($archive);
        }
    }

    public function installArchive(string $archive, string $source = 'local'): string
    {
        $stage = $this->basePath . '/storage/tmp/plugin-install-' . bin2hex(random_bytes(8));
        $root = null;
        $target = null;
        $backup = null;
        $pluginId = null;
        $wasActive = false;

        try {
            $root = $this->extract($archive, $stage);
            $manifest = PluginManifest::fromFile($root . '/plugin.json');
            $pluginId = $manifest->id;
            $target = $this->plugins->pluginsPath() . '/' . $pluginId;
            $existing = $this->plugins->find($pluginId);
            $wasActive = $existing?->getAttribute('status') === PluginManager::STATUS_ACTIVE;

            $this->assertManagedPath($target);
            if (is_link($target)) {
                throw new InvalidPlatformPackage('The existing plugin path cannot be a symbolic link.');
            }
            if (is_dir($target)) {
                $backup = $target . '.backup-' . bin2hex(random_bytes(5));
                if ($wasActive) {
                    $this->manager->deactivate($pluginId);
                }
                if (!rename($target, $backup)) {
                    throw new InvalidPlatformPackage('The existing plugin could not be moved to a backup.');
                }
            }

            $parent = dirname($target);
            if (!is_dir($parent) && !mkdir($parent, 0770, true) && !is_dir($parent)) {
                throw new InvalidPlatformPackage('The plugin directory cannot be created.');
            }
            if (!rename($root, $target)) {
                throw new InvalidPlatformPackage('The plugin files could not be installed.');
            }
            $this->manager->install($pluginId);
            $record = Plugin::query()->find($pluginId);
            if ($record instanceof Plugin && Plugin::query()->getConnection()->getSchemaBuilder()->hasColumn('plugins', 'source')) {
                $record->setAttribute('source', in_array($source, ['catalog', 'local'], true) ? $source : 'local');
                $record->saveOrFail();
            }
            if ($wasActive) {
                $this->manager->activate($pluginId);
            }
            $this->deleteDirectory($backup);

            return $pluginId;
        } catch (\Throwable $exception) {
            if (is_string($target) && is_dir($target)) {
                $this->deleteDirectory($target);
            }
            if (is_string($backup) && is_dir($backup) && is_string($target)) {
                @rename($backup, $target);
                if ($wasActive && is_string($pluginId)) {
                    try { $this->manager->activate($pluginId); } catch (\Throwable) {}
                }
            }
            throw $exception;
        } finally {
            $this->deleteDirectory($stage);
        }
    }

    private function extract(string $archive, string $stage): string
    {
        if (!class_exists(\ZipArchive::class) || !is_file($archive) || !is_readable($archive)) {
            throw new InvalidPlatformPackage('A readable PHP ZIP extension and plugin archive are required.');
        }
        if (!mkdir($stage, 0770, true) && !is_dir($stage)) {
            throw new InvalidPlatformPackage('The plugin staging directory cannot be created.');
        }
        $zip = new \ZipArchive();
        if ($zip->open($archive) !== true) {
            throw new InvalidPlatformPackage('The plugin archive cannot be opened.');
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
        if ($manifestPath === null) {
            throw new InvalidPlatformPackage('The plugin archive must contain plugin.json.');
        }

        return dirname($manifestPath);
    }

    private function assertManagedPath(string $target): void
    {
        $root = realpath($this->plugins->pluginsPath());
        if ($root === false) {
            if (!is_dir($this->plugins->pluginsPath()) && !mkdir($this->plugins->pluginsPath(), 0770, true) && !is_dir($this->plugins->pluginsPath())) {
                throw new InvalidPlatformPackage('The managed plugin directory cannot be created.');
            }
            $root = realpath($this->plugins->pluginsPath());
        }
        $parent = dirname($target);
        if ($root === false || ($parent !== $root && !str_starts_with($parent, rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR))) {
            throw new InvalidPlatformPackage('The plugin path is outside the managed plugins directory.');
        }
    }

    private function deleteDirectory(?string $path): void
    {
        if (!is_string($path) || !is_dir($path)) return;
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($path);
    }
}
