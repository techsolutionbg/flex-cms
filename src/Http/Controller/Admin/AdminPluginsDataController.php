<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
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
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['status' => 403, 'message' => 'Достъпът е забранен.']], 403);
        }

        $availableVersions = [];
        try {
            $index = $this->remoteCatalog->pluginIndex();
            foreach (array_keys($index->manifests) as $pluginId) {
                $releases = $this->remoteCatalog->pluginManifest($pluginId)->releases;
                usort($releases, static fn($left, $right): int => version_compare($right->version->value, $left->version->value));
                if ($releases !== []) {
                    $availableVersions[$pluginId] = [
                        'version' => $releases[0]->version->value,
                        'release_notes' => $releases[0]->releaseNotes,
                    ];
                }
            }
        } catch (\Throwable) {
            // The update action remains disabled when the remote catalog is unavailable.
        }

        $extensions = [];
        foreach ($this->plugins->discover() as $entry) {
            $registered = $this->plugins->find($entry['manifest']->id);
            $plugin = $registered?->toPublicArray() ?? [
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

        return $this->responses->json(['plugins' => $extensions]);
    }
}
