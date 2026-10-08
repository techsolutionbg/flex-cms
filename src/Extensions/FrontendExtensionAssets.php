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
                if (!PluginPermissions::allows($this->approvedPermissions($plugin, $validated), PluginPermissions::FRONTEND_ASSETS)) {
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
            if (!PluginPermissions::allows($this->approvedPermissions($plugin, $validated), PluginPermissions::FRONTEND_ASSETS)) {
                return null;
            }

            $root = realpath((string) $plugin->getAttribute('path'));
            if ($root === false) {
                return null;
            }

            // Merge the stored allowlist with on-disk plugin.json so local asset edits
            // (and newly added modules) work without reinstalling the plugin.
            $frontend = $this->frontendAllowlist($root, $validated->frontend);
            $allowedType = in_array($asset, $frontend['styles'], true) ? 'style' : (in_array($asset, $frontend['scripts'], true) ? 'script' : null);
            if ($allowedType === null) {
                return null;
            }

            $path = realpath($root . DIRECTORY_SEPARATOR . $asset);
            if ($path === false || !is_file($path) || !str_starts_with($path, $root . DIRECTORY_SEPARATOR)) {
                return null;
            }

            return ['path' => $path, 'type' => $allowedType];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param array{scripts?: list<string>, styles?: list<string>} $stored
     * @return array{scripts: list<string>, styles: list<string>}
     */
    private function frontendAllowlist(string $root, array $stored): array
    {
        $scripts = array_values(array_unique($stored['scripts'] ?? []));
        $styles = array_values(array_unique($stored['styles'] ?? []));
        $diskPath = $root . DIRECTORY_SEPARATOR . 'plugin.json';
        if (!is_file($diskPath)) {
            return ['scripts' => $scripts, 'styles' => $styles];
        }

        try {
            $disk = PluginManifest::fromFile($diskPath)->frontend;
            $scripts = array_values(array_unique([...$scripts, ...($disk['scripts'] ?? [])]));
            $styles = array_values(array_unique([...$styles, ...($disk['styles'] ?? [])]));
        } catch (\Throwable) {
            // Keep the stored allowlist if the on-disk manifest is temporarily invalid.
        }

        return ['scripts' => $scripts, 'styles' => $styles];
    }

    private function url(string $id, string $asset): string
    {
        $segments = array_map(static fn(string $segment): string => rawurlencode($segment), explode('/', $asset));

        return '/extensions/' . implode('/', array_map('rawurlencode', explode('/', $id))) . '/assets/' . implode('/', $segments);
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
