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

/** Returns installed themes and their available catalog metadata for React administration. */
final readonly class AdminThemesDataController
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

        $themes = $this->themes->all();
        try {
            $index = $this->catalog->index();
            foreach ($themes as &$theme) {
                $remoteId = (string) $theme['id'];
                if (!isset($index->manifests[$remoteId])) continue;
                $releases = array_values(array_filter($this->catalog->manifest($remoteId)->releases, static fn($release): bool => $release->channel->value === 'stable'));
                usort($releases, static fn($left, $right): int => version_compare($right->version, $left->version));
                $latest = $releases[0] ?? null;
                if ($latest !== null) {
                    $theme['available_version'] = $latest->version;
                    $theme['update_available'] = version_compare((string) $latest->version, (string) $theme['version'], '>');
                    $theme['release_notes'] = $latest->releaseNotes;
                }
            }
            unset($theme);
        } catch (\Throwable) {
            // Local theme management remains available without a remote catalog.
        }

        return $this->responses->json(['themes' => $themes, 'catalog_available' => false]);
    }
}
