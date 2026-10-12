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

/** Returns the installed/discovered extensions for the React administration. */
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
        $discovered = $this->plugins->discover();
        /** @var array<string, Plugin> $registered */
        $registered = [];
        foreach ($this->plugins->all() as $plugin) {
            $registered[(string) $plugin->getAttribute('id')] = $plugin;
        }

        $availableVersions = $this->availableVersionsFor(
            array_map(static fn(array $entry): string => $entry['manifest']->id, $discovered),
        );

        $extensions = [];
        foreach ($discovered as $entry) {
            $registeredPlugin = $registered[$entry['manifest']->id] ?? null;
            $plugin = $registeredPlugin?->toPublicArray() ?? [
                'id' => $entry['manifest']->id,
                'name' => $entry['manifest']->name,
                'version' => $entry['manifest']->version,
                'description' => $entry['manifest']->description,
                'entrypoint' => $entry['manifest']->entrypoint,
                'path' => $entry['path'],
                'status' => 'discovered',
                'source' => 'local',
                'manifest' => $entry['manifest']->toArray(),
                'requested_permissions' => $entry['manifest']->permissions,
                'approved_permissions' => [],
                'last_error' => null,
                'installed_at' => null,
                'activated_at' => null,
            ];
            $currentVersion = (string) ($plugin['version'] ?? '');
            $available = $availableVersions[$entry['manifest']->id] ?? null;
            $availableVersion = is_array($available) ? ($available['version'] ?? null) : null;
            $plugin['available_version'] = $availableVersion;
            $plugin['available_release_notes'] = is_array($available) ? ($available['release_notes'] ?? null) : null;
            $plugin['update_available'] = is_string($availableVersion) && $currentVersion !== '' && version_compare($availableVersion, $currentVersion, '>');
            $extensions[] = $plugin;
        }

        return $extensions;
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
