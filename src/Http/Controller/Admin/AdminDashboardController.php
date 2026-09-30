<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;
use Flex\Extensions\AdminExtensionRegistry;
use Flex\Extensions\PluginRegistry;
use Flex\Pages\PageRepository;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SettingRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Users\UserRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminDashboardController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private PageRepository $pages,
        private PluginRegistry $plugins,
        private UserRepository $users,
        private ResponseFactoryInterface $responses,
        private CsrfTokenManager $csrf,
        private SettingRepository $settings,
        private PlatformVersionRegistry $versions,
        private ViewRendererInterface $views,
        private ViteAssetManager $assets,
        private AdminExtensionRegistry $adminExtensions,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Достъпът е забранен.', 403);
        }

        $bootstrap = [
            'page' => 'dashboard',
            'csrfToken' => $this->csrf->token(),
            'sidebarWidth' => $this->settings->sidebarWidthForUser($user->id),
            'sidebarCollapsed' => $this->settings->sidebarCollapsedForUser($user->id),
            'collapsedSections' => $this->settings->collapsedSectionsForUser($user->id),
            'version' => $this->versions->current()->value,
            'pages' => $this->pages->all()->map(static fn(\Flex\Pages\Page $page): array => $page->toPublicArray())->all(),
            'plugins' => $this->plugins->all()->map(static fn(\Flex\Extensions\Plugin $plugin): array => $plugin->toPublicArray())->all(),
            'users' => $this->users->all()->count(),
            'adminExtensions' => $this->adminExtensions->bootstrap(),
        ];

        return $this->responses->html($this->views->render('admin/app.twig', ['title' => 'Административен панел', 'vite_tags' => $this->assets->tags(), 'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)]));
    }
}
