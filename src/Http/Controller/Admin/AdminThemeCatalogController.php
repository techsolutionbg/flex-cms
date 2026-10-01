<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SettingRepository;
use Flex\Themes\ThemeManager;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Updates\Remote\ThemeCatalogClient;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminThemeCatalogController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ThemeManager $themes,
        private ResponseFactoryInterface $responses,
        private CsrfTokenManager $csrf,
        private SettingRepository $settings,
        private PlatformVersionRegistry $versions,
        private ViewRendererInterface $views,
        private ViteAssetManager $assets,
        private ThemeCatalogClient $catalog,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Достъпът е забранен.', 403);
        }

        $localThemes = $this->themes->all();
        $themeCatalog = [];
        try {
            $index = $this->catalog->index();
            foreach ($index->manifests as $remoteId => $_manifestUrl) {
                $metadata = $index->metadata[$remoteId] ?? [];
                $releases = array_values(array_filter(
                    $this->catalog->manifest($remoteId)->releases,
                    static fn($release): bool => $release->channel->value === 'stable',
                ));
                usort($releases, static fn($left, $right): int => version_compare($right->version, $left->version));
                $latest = $releases[0] ?? null;
                if ($latest === null) continue;

                $installed = array_values(array_filter(
                    $localThemes,
                    static fn(array $theme): bool => $theme['id'] === $remoteId,
                ))[0] ?? null;
                $themeCatalog[] = [
                    'id' => $remoteId,
                    'name' => (string) ($metadata['name'] ?? $remoteId),
                    'description' => (string) ($metadata['description'] ?? ''),
                    'author' => (string) ($metadata['author'] ?? ''),
                    'version' => $latest->version,
                    'published_at' => $latest->publishedAt,
                    'release_notes' => $latest->releaseNotes,
                    'size' => $latest->size,
                    'minimum_php' => $latest->minimumPhp,
                    'compatible_from' => $latest->compatibleFrom,
                    'installed' => is_array($installed),
                    'installed_version' => is_array($installed) ? $installed['version'] : null,
                    'active' => is_array($installed) && $installed['active'] === true,
                    'installation_status' => is_array($installed) ? ($installed['active'] === true ? 'active' : 'installed') : 'not_installed',
                ];
            }
        } catch (\Throwable) {
            // The catalog page remains usable when the remote source is unavailable.
        }

        $bootstrap = [
            'page' => 'theme-catalog',
            'csrfToken' => $this->csrf->token(),
            'sidebarWidth' => $this->settings->sidebarWidthForUser($user->id),
            'sidebarCollapsed' => $this->settings->sidebarCollapsedForUser($user->id),
            'collapsedSections' => $this->settings->collapsedSectionsForUser($user->id),
            'version' => $this->versions->current()->value,
            'themeCatalog' => $themeCatalog,
        ];

        return $this->responses->html($this->views->render('admin/app.twig', [
            'title' => 'Каталог с теми',
            'vite_tags' => $this->assets->tags(),
            'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
        ]));
    }
}
