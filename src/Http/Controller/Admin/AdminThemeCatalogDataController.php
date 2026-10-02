<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Themes\ThemeManager;
use Flex\Updates\Remote\ThemeCatalogClient;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/** Returns the remote theme store with local installation status. */
final readonly class AdminThemeCatalogDataController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ThemeManager $themes,
        private ThemeCatalogClient $catalog,
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
            $index = $this->catalog->index();
            $installed = $this->themes->all();
            $catalog = [];
            foreach ($index->manifests as $id => $_manifestUrl) {
                $manifest = $this->catalog->manifest($id);
                $releases = array_values(array_filter($manifest->releases, static fn($release): bool => $release->channel->value === 'stable'));
                if ($releases === []) $releases = $manifest->releases;
                usort($releases, static fn($left, $right): int => version_compare($right->version, $left->version));
                $latest = $releases[0] ?? null;
                if ($latest === null) continue;

                $local = array_values(array_filter($installed, static fn(array $theme): bool => $theme['id'] === $id))[0] ?? null;
                $metadata = $index->metadata[$id] ?? [];
                $catalog[] = [
                    'id' => $id,
                    'name' => (string) ($metadata['name'] ?? $id),
                    'description' => (string) ($metadata['description'] ?? ''),
                    'author' => (string) ($metadata['author'] ?? ''),
                    'screenshot_url' => is_string($metadata['screenshot_url'] ?? null) ? $metadata['screenshot_url'] : null,
                    'tags' => is_array($metadata['tags'] ?? null) ? array_values(array_filter($metadata['tags'], 'is_string')) : [],
                    'version' => $latest->version,
                    'release_notes' => $latest->releaseNotes,
                    'published_at' => $latest->publishedAt,
                    'size' => $latest->size,
                    'minimum_php' => $latest->minimumPhp,
                    'compatible_from' => $latest->compatibleFrom,
                    'installed' => is_array($local),
                    'active' => is_array($local) && $local['active'] === true,
                    'installed_version' => is_array($local) ? $local['version'] : null,
                    'update_available' => is_array($local) && version_compare($latest->version, (string) $local['version'], '>'),
                ];
            }

            return $this->responses->json(['catalog' => $catalog]);
        } catch (\Throwable) {
            return $this->responses->json(['error' => ['status' => 502, 'message' => 'Каталогът с теми временно не е достъпен.']], 502);
        }
    }
}
