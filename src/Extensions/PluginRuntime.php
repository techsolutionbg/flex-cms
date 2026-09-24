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
                $this->extensionApi,
                $this->routes === null ? null : new PluginRouteRegistrar($this->routes, $validatedManifest->id, $validatedManifest->permissions),
                $validatedManifest->permissions,
            ));
        }
    }
}
