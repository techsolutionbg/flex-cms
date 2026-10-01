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

final readonly class AdminPluginCatalogDataController
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

        try {
            $index = $this->remoteCatalog->pluginIndex();
            $installed = [];
            foreach ($this->plugins->discover() as $entry) {
                $plugin = $this->plugins->find($entry['manifest']->id);
                if ($plugin !== null) {
                    $installed[$entry['manifest']->id] = $plugin->toPublicArray();
                }
            }

            $catalog = [];
            foreach ($index->manifests as $id => $_manifestUrl) {
                $remote = $this->remoteCatalog->pluginManifest($id);
                $releases = array_values(array_filter($remote->releases, static fn($release): bool => $release->channel->value === 'stable'));
                // A catalog item must remain visible even when the local update
                // channel differs from stable. Installation still validates the
                // configured channel in the installer itself.
                if ($releases === []) {
                    $releases = $remote->releases;
                }
                usort($releases, static fn($left, $right): int => version_compare($right->version->value, $left->version->value));
                $latest = $releases[0] ?? null;
                if ($latest === null) {
                    continue;
                }
                $local = $installed[$id] ?? null;
                $localStatus = $local['status'] ?? null;
                $installationStatus = $localStatus === 'active' ? 'active' : (in_array($localStatus, ['installed', 'error'], true) ? 'installed' : ($localStatus === 'inactive' ? 'inactive' : 'not_installed'));
                $metadata = $index->metadata[$id] ?? [];
                $catalog[] = [
                    'id' => $id,
                    'name' => (string) ($metadata['name'] ?? $id),
                    'description' => (string) ($metadata['description'] ?? ''),
                    'author' => (string) ($metadata['author'] ?? ''),
                    'icon_url' => (string) ($metadata['icon_url'] ?? ''),
                    'version' => $latest->version->value,
                    'release_notes' => $latest->releaseNotes,
                    'size' => $latest->size,
                    'published_at' => $latest->publishedAt,
                    'minimum_php' => $latest->minimumPhp,
                    'compatible_from' => $latest->compatibleFrom,
                    'minimum_platform_version' => (string) ($metadata['minimum_platform_version'] ?? ''),
                    'permissions' => $metadata['permissions'] ?? [],
                    'installation_status' => $installationStatus,
                    'installed_version' => $local['version'] ?? null,
                    'update_available' => is_string($local['version'] ?? null) && version_compare($latest->version->value, $local['version'], '>'),
                ];
            }

            return $this->responses->json(['catalog' => $catalog]);
        } catch (\Throwable $exception) {
            return $this->responses->json(['error' => ['status' => 502, 'message' => 'Каталогът с разширения временно не е достъпен.']], 502);
        }
    }
}
