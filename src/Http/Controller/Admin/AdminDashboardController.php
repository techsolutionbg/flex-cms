<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;
use Flex\Extensions\AdminExtensionRegistry;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SettingRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminDashboardController
{
    public function __construct(private AuthenticationInterface $authentication, private ResponseFactoryInterface $responses, private CsrfTokenManager $csrf, private SettingRepository $settings, private PlatformVersionRegistry $versions, private ViewRendererInterface $views, private ViteAssetManager $assets, private AdminExtensionRegistry $adminExtensions) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Forbidden', 403);
        }

        $bootstrap = ['page' => 'dashboard', 'csrfToken' => $this->csrf->token(), 'sidebarWidth' => $this->settings->sidebarWidthForUser($user->id), 'sidebarCollapsed' => $this->settings->sidebarCollapsedForUser($user->id), 'collapsedSections' => $this->settings->collapsedSectionsForUser($user->id), 'version' => $this->versions->current()->value, 'adminExtensions' => $this->adminExtensions->bootstrap()];

        return $this->responses->html($this->views->render('admin/app.twig', ['title' => 'Административен панел', 'vite_tags' => $this->assets->tags(), 'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)]));
    }
}
