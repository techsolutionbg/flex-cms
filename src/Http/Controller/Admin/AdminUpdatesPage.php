<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;
use Flex\Settings\SettingRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Extensions\AdminExtensionRegistry;

final readonly class AdminUpdatesPage
{
    public function __construct(private AuthenticationInterface $authentication, private SettingRepository $settings, private PlatformVersionRegistry $versions, private ViewRendererInterface $views, private ViteAssetManager $assets, private AdminExtensionRegistry $adminExtensions) {}

    /**
     * @param list<array<string, mixed>> $history
     * @param array<string, mixed>|null $inspection
     */
    public function render(string $csrfToken, array $history, ?string $notice = null, ?string $error = null, ?array $inspection = null): string
    {
        $user = $this->authentication->user();
        $bootstrap = ['page' => 'updates', 'csrfToken' => $csrfToken, 'sidebarWidth' => $user instanceof AuthenticatedUser ? $this->settings->sidebarWidthForUser($user->id) : 248, 'sidebarCollapsed' => $user instanceof AuthenticatedUser ? $this->settings->sidebarCollapsedForUser($user->id) : false, 'collapsedSections' => $user instanceof AuthenticatedUser ? $this->settings->collapsedSectionsForUser($user->id) : [], 'version' => $this->versions->current()->value, 'history' => array_reverse($history), 'notice' => $notice, 'error' => $error, 'inspection' => $inspection, 'adminExtensions' => $this->adminExtensions->bootstrap()];

        return $this->views->render('admin/app.twig', ['title' => 'Обновявания', 'vite_tags' => $this->assets->tags(), 'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)]);
    }
}
