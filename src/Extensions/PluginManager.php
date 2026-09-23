<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\PluginContext;
use Flex\Extension\V1\UpdatablePluginInterface;
use Flex\Extension\V1\UninstallablePluginInterface;
use Flex\Extensions\Exception\PluginLifecycleException;
use Flex\Extensions\Exception\PluginNotFound;

final readonly class PluginManager
{
    public const STATUS_INSTALLED = 'installed';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_ERROR = 'error';

    public function __construct(
        private PluginRegistry $registry,
        private PluginEntrypointLoader $entrypointLoader,
    ) {}

    public function install(string $id): Plugin
    {
        $entry = $this->discovered($id);
        $manifest = $entry['manifest'];
        $plugin = $this->registry->find($id) ?? new Plugin(['id' => $id]);
        $wasInstalled = $plugin->exists;
        $wasActive = $wasInstalled && $plugin->getAttribute('status') === self::STATUS_ACTIVE;
        $fromVersion = $wasInstalled ? (string) $plugin->getAttribute('version') : '';
        $isUpdate = $wasInstalled && $fromVersion !== '' && $fromVersion !== $manifest->version;
        $status = $wasActive
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
            'last_error' => null,
            'installed_at' => $plugin->exists ? $plugin->getAttribute('installed_at') : new \DateTimeImmutable(),
        ]);
        $plugin->saveOrFail();

        if ($wasInstalled && !$isUpdate) {
            return $plugin;
        }

        try {
            $entrypoint = $this->entrypointLoader->load($manifest, $entry['path']);
            if ($isUpdate) {
                if ($entrypoint instanceof UpdatablePluginInterface) {
                    $entrypoint->update($this->context($manifest, $entry['path']), $fromVersion);
                }
            } else {
                $entrypoint->install($this->context($manifest, $entry['path']));
            }
        } catch (\Throwable $exception) {
            $this->recordFailure($plugin, $exception);
            throw new PluginLifecycleException(sprintf('Installing plugin "%s" failed: %s', $id, $exception->getMessage()), previous: $exception);
        }

        return $plugin;
    }

    public function activate(string $id): Plugin
    {
        $plugin = $this->installed($id);
        if ($plugin->getAttribute('status') === self::STATUS_ACTIVE) {
            return $plugin;
        }

        [$manifest, $path] = $this->manifestAndPath($plugin);
        try {
            $this->entrypointLoader->load($manifest, $path)->activate($this->context($manifest, $path));
        } catch (\Throwable $exception) {
            $this->recordFailure($plugin, $exception);
            throw new PluginLifecycleException(sprintf('Activating plugin "%s" failed: %s', $id, $exception->getMessage()), previous: $exception);
        }

        $plugin->fill([
            'status' => self::STATUS_ACTIVE,
            'activated_at' => new \DateTimeImmutable(),
            'last_error' => null,
        ]);
        $plugin->saveOrFail();

        return $plugin;
    }

    public function deactivate(string $id): Plugin
    {
        $plugin = $this->installed($id);
        if ($plugin->getAttribute('status') !== self::STATUS_ACTIVE) {
            return $plugin;
        }

        [$manifest, $path] = $this->manifestAndPath($plugin);
        try {
            $this->entrypointLoader->load($manifest, $path)->deactivate($this->context($manifest, $path));
        } catch (\Throwable $exception) {
            $this->recordFailure($plugin, $exception);
            throw new PluginLifecycleException(sprintf('Deactivating plugin "%s" failed: %s', $id, $exception->getMessage()), previous: $exception);
        }

        $plugin->fill([
            'status' => self::STATUS_INACTIVE,
            'activated_at' => null,
            'last_error' => null,
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

        [$manifest, $pluginPath] = $this->manifestAndPath($plugin);
        try {
            $entrypoint = $this->entrypointLoader->load($manifest, $pluginPath);
            if ($entrypoint instanceof UninstallablePluginInterface) {
                $entrypoint->uninstall($this->context($manifest, $pluginPath));
            }
        } catch (\Throwable $exception) {
            $this->recordFailure($plugin, $exception);
            throw new PluginLifecycleException(sprintf('Uninstalling plugin "%s" failed: %s', $id, $exception->getMessage()), previous: $exception);
        }

        $path = realpath($pluginPath);
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

    /** @return array{0: PluginManifest, 1: string} */
    private function manifestAndPath(Plugin $plugin): array
    {
        $manifest = $plugin->getAttribute('manifest');
        if (!is_array($manifest)) {
            throw new PluginLifecycleException(sprintf('Plugin "%s" has no valid stored manifest.', $plugin->getKey()));
        }

        return [PluginManifest::fromArray($manifest), (string) $plugin->getAttribute('path')];
    }

    private function context(PluginManifest $manifest, string $path): PluginContext
    {
        return new PluginContext($manifest->id, $manifest->version, $path, $manifest->toArray());
    }

    private function recordFailure(Plugin $plugin, \Throwable $exception): void
    {
        $plugin->fill(['status' => self::STATUS_ERROR, 'last_error' => $exception->getMessage()]);
        $plugin->saveOrFail();
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
