<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Admin\AdminPluginsSnapshotCache;
use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extensions\Plugin;
use Flex\Extensions\PluginRegistry;
use Flex\Updates\Remote\RemoteCatalogClient;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/** Returns installed extensions for the React administration (catalog lists the rest). */
final readonly class AdminPluginsDataController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private PluginRegistry $plugins,
        private RemoteCatalogClient $remoteCatalog,
        private AdminPluginsSnapshotCache $snapshot,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['status' => 403, 'message' => 'Достъпът е забранен.']], 403);
        }

        $hardRefresh = $this->snapshot->wantsHardRefresh($request);
        if ($hardRefresh) {
            $this->snapshot->forget();
        } elseif (($cached = $this->snapshot->read()) !== null) {
            return $this->responses->json(['plugins' => $cached], 200, [
                'Cache-Control' => 'private, max-age=30',
                'X-Flex-Cache' => 'HIT',
            ]);
        }

        $extensions = $this->buildExtensions();
        $this->snapshot->write($extensions);

        return $this->responses->json(['plugins' => $extensions], 200, [
            'Cache-Control' => 'private, max-age=30',
            'X-Flex-Cache' => $hardRefresh ? 'REFRESH' : 'MISS',
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function buildExtensions(): array
    {
        $installed = $this->plugins->all();
        /** @var array<string, Plugin> $installedById */
        $installedById = [];
        foreach ($installed as $registeredPlugin) {
            $installedById[(string) $registeredPlugin->getAttribute('id')] = $registeredPlugin;
        }

        $pluginIds = array_keys($installedById);
        foreach ($this->plugins->discover() as $entry) {
            $discoveredId = $entry['manifest']->id;
            if (!isset($installedById[$discoveredId])) {
                $pluginIds[] = $discoveredId;
            }
        }

        $availableVersions = $this->availableVersionsFor($pluginIds);

        $extensions = [];
        foreach ($installed as $registeredPlugin) {
            $extensions[] = $this->publicPluginRecord(
                $registeredPlugin->toPublicArray(),
                $availableVersions,
            );
        }

        foreach ($this->plugins->discover() as $entry) {
            $manifest = $entry['manifest'];
            if (isset($installedById[$manifest->id])) {
                continue;
            }
            $extensions[] = $this->publicPluginRecord([
                'id' => $manifest->id,
                'name' => $manifest->name,
                'version' => $manifest->version,
                'description' => $manifest->description,
                'entrypoint' => $manifest->entrypoint,
                'path' => $entry['path'],
                'status' => 'discovered',
                'source' => 'local',
                'manifest' => $manifest->toArray(),
                'requested_permissions' => $manifest->permissions,
                'approved_permissions' => [],
                'last_error' => null,
                'installed_at' => null,
                'activated_at' => null,
            ], $availableVersions);
        }

        usort($extensions, static fn(array $left, array $right): int => strcmp((string) ($left['name'] ?? ''), (string) ($right['name'] ?? '')));

        return $extensions;
    }

    /**
     * @param array<string, mixed> $plugin
     * @param array<string, array{version: string, release_notes: string|null}> $availableVersions
     *
     * @return array<string, mixed>
     */
    private function publicPluginRecord(array $plugin, array $availableVersions): array
    {
        $id = (string) ($plugin['id'] ?? '');
        $currentVersion = (string) ($plugin['version'] ?? '');
        $available = $availableVersions[$id] ?? null;
        $availableVersion = is_array($available) ? ($available['version'] ?? null) : null;
        $plugin['available_version'] = $availableVersion;
        $plugin['available_release_notes'] = is_array($available) ? ($available['release_notes'] ?? null) : null;
        $plugin['update_available'] = is_string($availableVersion) && $currentVersion !== '' && version_compare($availableVersion, $currentVersion, '>');

        return $plugin;
    }

    /**
     * @param list<string> $pluginIds
     *
     * @return array<string, array{version: string, release_notes: string|null}>
     */
    private function availableVersionsFor(array $pluginIds): array
    {
        $availableVersions = [];
        try {
            $index = $this->remoteCatalog->pluginIndex();
            foreach ($pluginIds as $pluginId) {
                if (!isset($index->manifests[$pluginId])) {
                    continue;
                }
                try {
                    $releases = $this->remoteCatalog->pluginManifest($pluginId)->releases;
                } catch (\Throwable) {
                    continue;
                }
                usort($releases, static fn($left, $right): int => version_compare($right->version->value, $left->version->value));
                if ($releases === []) {
                    continue;
                }
                $availableVersions[$pluginId] = [
                    'version' => $releases[0]->version->value,
                    'release_notes' => $releases[0]->releaseNotes,
                ];
            }
        } catch (\Throwable) {
            // The update action remains disabled when the remote catalog is unavailable.
        }

        return $availableVersions;
    }
}
