<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Extension\V1\EventNames;
use Flex\Extension\V1\PluginEvent;
use Flex\Extension\V1\PluginContext;
use Flex\Extension\V1\UpdatablePluginInterface;
use Flex\Extension\V1\UninstallablePluginInterface;
use Flex\Extensions\Exception\PluginLifecycleException;
use Flex\Extensions\Exception\PluginNotFound;
use Flex\Extensions\Exception\PluginPermissionDenied;
use Illuminate\Database\Connection;
use Psr\Log\LoggerInterface;

final readonly class PluginManager
{
    public const STATUS_INSTALLED = 'installed';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_ERROR = 'error';

    public function __construct(
        private PluginRegistry $registry,
        private PluginEntrypointLoader $entrypointLoader,
        private ExtensionApiInterface $extensionApi,
        private ?ContentBlockRegistry $contentBlocks = null,
        private ?LoggerInterface $logger = null,
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
        $this->storePermissions($plugin, $manifest->permissions);
        $plugin->saveOrFail();
        $this->audit($isUpdate ? 'update' : 'install', $id, ['version' => $manifest->version]);

        if ($wasInstalled && !$isUpdate) {
            return $plugin;
        }

        try {
            $entrypoint = $this->entrypointLoader->load($manifest, $entry['path']);
            if ($isUpdate) {
                if ($entrypoint instanceof UpdatablePluginInterface) {
                    $entrypoint->update($this->context($manifest, $entry['path'], $this->approvedPermissions($plugin, $manifest)), $fromVersion);
                }
            } else {
                $entrypoint->install($this->context($manifest, $entry['path'], $this->approvedPermissions($plugin, $manifest)));
            }
        } catch (\Throwable $exception) {
            $this->recordFailure($plugin, $exception);
            throw new PluginLifecycleException(sprintf('Installing plugin "%s" failed: %s', $id, $exception->getMessage()), previous: $exception);
        }

        $this->extensionApi->dispatch(new PluginEvent(
            $isUpdate ? EventNames::PLUGIN_UPDATED : EventNames::PLUGIN_INSTALLED,
            $manifest->id,
            $manifest->version,
            $entry['path'],
            $isUpdate ? $fromVersion : '',
        ));

        return $plugin;
    }

    public function activate(string $id): Plugin
    {
        $plugin = $this->installed($id);
        if ($plugin->getAttribute('status') === self::STATUS_ACTIVE) {
            return $plugin;
        }

        [$manifest, $path] = $this->manifestAndPath($plugin);
        $this->assertPermissionsApproved($plugin, $manifest);
        try {
            $this->entrypointLoader->load($manifest, $path)->activate($this->context($manifest, $path, $this->approvedPermissions($plugin, $manifest)));
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
        $this->audit('activate', $id, ['version' => $manifest->version]);
        $this->extensionApi->dispatch(new PluginEvent(EventNames::PLUGIN_ACTIVATED, $manifest->id, $manifest->version, $path));

        return $plugin;
    }

    /** @param list<string> $approved */
    public function approvePermissions(string $id, array $approved): Plugin
    {
        $plugin = $this->installed($id);
        if ($plugin->getAttribute('status') === self::STATUS_ACTIVE) {
            throw new \RuntimeException('Deactivate the plugin before changing its permissions.');
        }

        [$manifest] = $this->manifestAndPath($plugin);
        $requested = $this->requestedPermissions($plugin, $manifest);
        $approved = array_values(array_unique(array_filter($approved, 'is_string')));
        $unknown = array_diff($approved, $requested);
        if ($unknown !== []) {
            throw new PluginPermissionDenied(sprintf('Unknown permissions: %s.', implode(', ', $unknown)));
        }
        if (!$this->permissionsColumnsAvailable()) {
            throw new PluginPermissionDenied('The plugin permission storage migration has not been applied.');
        }

        $plugin->setAttribute('approved_permissions', $approved);
        $plugin->saveOrFail();
        $this->audit('approve_permissions', $id, ['permissions' => $approved]);

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
            $this->entrypointLoader->load($manifest, $path)->deactivate($this->context($manifest, $path, $this->approvedPermissions($plugin, $manifest)));
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
        $this->audit('deactivate', $id, ['version' => $manifest->version]);
        $this->extensionApi->dispatch(new PluginEvent(EventNames::PLUGIN_DEACTIVATED, $manifest->id, $manifest->version, $path));

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
                $entrypoint->uninstall($this->context($manifest, $pluginPath, $this->approvedPermissions($plugin, $manifest)));
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

        $pluginId = (string) $plugin->getAttribute('id');
        $pluginVersion = (string) $plugin->getAttribute('version');
        $plugin->delete();
        $this->deleteDirectory($path);
        $this->audit('uninstall', $pluginId, ['version' => $pluginVersion]);
        $this->extensionApi->dispatch(new PluginEvent(EventNames::PLUGIN_UNINSTALLED, $pluginId, $pluginVersion, $path));
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

    /** @param list<string>|null $permissions */
    private function context(PluginManifest $manifest, string $path, ?array $permissions = null): PluginContext
    {
        $effectivePermissions = $permissions ?? $manifest->permissions;

        return new PluginContext($manifest->id, $manifest->version, $path, $manifest->toArray(), new ScopedExtensionApi($this->extensionApi, $manifest->id, $effectivePermissions), null, $effectivePermissions, $this->contentBlocks?->registrar($manifest->id, $effectivePermissions));
    }

    /** @param list<string> $requested */
    private function storePermissions(Plugin $plugin, array $requested): void
    {
        if (!$this->permissionsColumnsAvailable()) {
            return;
        }

        $approved = array_values(array_intersect($plugin->approvedPermissions(), $requested));
        $plugin->setAttribute('requested_permissions', $requested);
        $plugin->setAttribute('approved_permissions', $approved);
    }

    private function assertPermissionsApproved(Plugin $plugin, PluginManifest $manifest): void
    {
        $requested = $this->requestedPermissions($plugin, $manifest);
        $approved = $this->approvedPermissions($plugin, $manifest);
        $missing = PluginPermissions::missing($requested, $approved);
        if ($missing !== []) {
            $this->audit('permission_denied', $manifest->id, ['permissions' => $missing, 'action' => 'activate']);
            throw new PluginPermissionDenied(sprintf('Plugin "%s" requires approval for: %s.', $manifest->id, implode(', ', $missing)));
        }
    }

    /** @return list<string> */
    private function requestedPermissions(Plugin $plugin, PluginManifest $manifest): array
    {
        return $this->permissionsColumnsAvailable() ? $plugin->requestedPermissions() : $manifest->permissions;
    }

    /** @return list<string> */
    private function approvedPermissions(Plugin $plugin, PluginManifest $manifest): array
    {
        return $this->permissionsColumnsAvailable() ? $plugin->approvedPermissions() : $manifest->permissions;
    }

    private function permissionsColumnsAvailable(): bool
    {
        try {
            $connection = Plugin::query()->getConnection();
            if (!$connection instanceof Connection) {
                return false;
            }

            return $connection->getSchemaBuilder()->hasColumn('plugins', 'approved_permissions');
        } catch (\Throwable) {
            return false;
        }
    }

    /** @param array<string, mixed> $context */
    private function audit(string $action, string $pluginId, array $context = []): void
    {
        $this->logger?->info('Plugin audit event.', ['plugin_id' => $pluginId, 'action' => $action] + $context);
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
