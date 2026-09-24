<?php

declare(strict_types=1);

namespace Flex\Extensions;

final readonly class FrontendExtensionAssets
{
    public function __construct(private PluginRegistry $plugins) {}

    public function tags(): string
    {
        $tags = [];

        try {
            foreach ($this->plugins->all() as $plugin) {
                if ($plugin->getAttribute('status') !== PluginManager::STATUS_ACTIVE) {
                    continue;
                }

                $manifest = $plugin->getAttribute('manifest');
                if (!is_array($manifest)) {
                    continue;
                }

                $validated = PluginManifest::fromArray($manifest);
                if (!PluginPermissions::allows($validated->permissions, PluginPermissions::FRONTEND_ASSETS)) {
                    continue;
                }
                foreach ($validated->frontend['styles'] ?? [] as $asset) {
                    $tags[] = sprintf('<link rel="stylesheet" href="%s">', $this->url($validated->id, $asset));
                }
                foreach ($validated->frontend['scripts'] ?? [] as $asset) {
                    $tags[] = sprintf('<script type="module" src="%s"></script>', $this->url($validated->id, $asset));
                }
            }
        } catch (\Throwable) {
            // Frontend assets must never prevent the installer or error page from rendering.
        }

        return implode("\n", $tags);
    }

    /** @return array{path: string, type: string}|null */
    public function resolve(string $id, string $asset): ?array
    {
        try {
            $plugin = $this->plugins->find($id);
            if ($plugin === null || $plugin->getAttribute('status') !== PluginManager::STATUS_ACTIVE) {
                return null;
            }

            $manifest = $plugin->getAttribute('manifest');
            if (!is_array($manifest)) {
                return null;
            }
            $validated = PluginManifest::fromArray($manifest);
            if (!PluginPermissions::allows($validated->permissions, PluginPermissions::FRONTEND_ASSETS)) {
                return null;
            }
            $allowedType = in_array($asset, $validated->frontend['styles'] ?? [], true) ? 'style' : (in_array($asset, $validated->frontend['scripts'] ?? [], true) ? 'script' : null);
            if ($allowedType === null) {
                return null;
            }

            $root = realpath((string) $plugin->getAttribute('path'));
            $path = $root === false ? false : realpath($root . DIRECTORY_SEPARATOR . $asset);
            if ($path === false || !is_file($path) || !str_starts_with($path, $root . DIRECTORY_SEPARATOR)) {
                return null;
            }

            return ['path' => $path, 'type' => $allowedType];
        } catch (\Throwable) {
            return null;
        }
    }

    private function url(string $id, string $asset): string
    {
        $segments = array_map(static fn(string $segment): string => rawurlencode($segment), explode('/', $asset));

        return '/extensions/' . rawurlencode($id) . '/assets/' . implode('/', $segments);
    }
}
