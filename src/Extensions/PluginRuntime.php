<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\BootablePluginInterface;
use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Extension\V1\PluginContext;
use Flex\Contracts\Http\RouteRegistryInterface;

final readonly class PluginRuntime
{
    public function __construct(
        private PluginRegistry $registry,
        private PluginEntrypointLoader $entrypointLoader,
        private ExtensionApiInterface $extensionApi,
        private ?ContentBlockRegistry $contentBlocks = null,
        private ?RouteRegistryInterface $routes = null,
    ) {}

    public function bootActive(): void
    {
        foreach ($this->registry->all() as $plugin) {
            if ($plugin->getAttribute('status') !== PluginManager::STATUS_ACTIVE) {
                continue;
            }

            $manifest = $plugin->getAttribute('manifest');
            if (!is_array($manifest)) {
                continue;
            }

            $validatedManifest = PluginManifest::fromArray($manifest);
            $path = (string) $plugin->getAttribute('path');
            $entrypoint = $this->entrypointLoader->load($validatedManifest, $path);
            if (!$entrypoint instanceof BootablePluginInterface) {
                continue;
            }

            $entrypoint->boot(new PluginContext(
                $validatedManifest->id,
                $validatedManifest->version,
                $path,
                $validatedManifest->toArray(),
                new ScopedExtensionApi($this->extensionApi, $validatedManifest->id, $this->approvedPermissions($plugin, $validatedManifest)),
                $this->routes === null ? null : new PluginRouteRegistrar($this->routes, $validatedManifest->id, $this->approvedPermissions($plugin, $validatedManifest)),
                $this->approvedPermissions($plugin, $validatedManifest),
                $this->contentBlocks?->registrar($validatedManifest->id, $this->approvedPermissions($plugin, $validatedManifest)),
            ));
        }
    }

    /** @return list<string> */
    private function approvedPermissions(Plugin $plugin, PluginManifest $manifest): array
    {
        if (array_key_exists('approved_permissions', $plugin->getAttributes())) {
            return $plugin->approvedPermissions();
        }

        return $manifest->permissions;
    }
}
