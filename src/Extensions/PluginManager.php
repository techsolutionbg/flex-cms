<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extensions\Exception\PluginNotFound;

final readonly class PluginManager
{
    public const STATUS_INSTALLED = 'installed';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';

    public function __construct(private PluginRegistry $registry) {}

    public function install(string $id): Plugin
    {
        $entry = $this->discovered($id);
        $manifest = $entry['manifest'];
        $plugin = $this->registry->find($id) ?? new Plugin(['id' => $id]);
        $status = $plugin->exists && $plugin->getAttribute('status') === self::STATUS_ACTIVE
            ? self::STATUS_ACTIVE
            : self::STATUS_INSTALLED;

        $plugin->fill([
            'name' => $manifest->name,
            'version' => $manifest->version,
            'description' => $manifest->description,
            'entrypoint' => $manifest->entrypoint,
            'path' => $entry['path'],
            'status' => $status,
            'manifest' => $manifest->toArray(),
            'installed_at' => $plugin->exists ? $plugin->getAttribute('installed_at') : new \DateTimeImmutable(),
        ]);
        $plugin->saveOrFail();

        return $plugin;
    }

    public function activate(string $id): Plugin
    {
        $plugin = $this->installed($id);
        $plugin->fill([
            'status' => self::STATUS_ACTIVE,
            'activated_at' => $plugin->getAttribute('activated_at') ?? new \DateTimeImmutable(),
        ]);
        $plugin->saveOrFail();

        return $plugin;
    }

    public function deactivate(string $id): Plugin
    {
        $plugin = $this->installed($id);
        $plugin->fill([
            'status' => self::STATUS_INACTIVE,
            'activated_at' => null,
        ]);
        $plugin->saveOrFail();

        return $plugin;
    }

    public function uninstall(string $id): void
    {
        $plugin = $this->installed($id);
        if ($plugin->getAttribute('status') === self::STATUS_ACTIVE) {
            throw new \RuntimeException(sprintf('Plugin "%s" must be deactivated before it can be uninstalled.', $id));
        }

        $path = realpath((string) $plugin->getAttribute('path'));
        $pluginsPath = realpath($this->registry->pluginsPath());
        if ($path === false || $pluginsPath === false || $path === $pluginsPath || !str_starts_with($path, $pluginsPath . DIRECTORY_SEPARATOR)) {
            throw new \RuntimeException(sprintf('Plugin "%s" has an unsafe installation path.', $id));
        }

        $plugin->delete();
        $this->deleteDirectory($path);
    }

    /** @return array{manifest: PluginManifest, path: string} */
    private function discovered(string $id): array
    {
        foreach ($this->registry->discover() as $entry) {
            if ($entry['manifest']->id === $id) {
                return $entry;
            }
        }

        throw new PluginNotFound(sprintf('Plugin "%s" was not found in the plugins directory.', $id));
    }

    private function installed(string $id): Plugin
    {
        $plugin = $this->registry->find($id);
        if (!$plugin instanceof Plugin) {
            throw new PluginNotFound(sprintf('Plugin "%s" is not installed.', $id));
        }

        return $plugin;
    }

    private function deleteDirectory(string $path): void
    {
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($path);
    }
}
