<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;
use Flex\Pages\PageRepository;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SettingRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminPagesFormController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private PageRepository $pages,
        private ResponseFactoryInterface $responses,
        private CsrfTokenManager $csrf,
        private SettingRepository $settings,
        private PlatformVersionRegistry $versions,
        private ViewRendererInterface $views,
        private ViteAssetManager $assets,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Forbidden', 403);
        }

        $id = isset($arguments['id']) ? filter_var($arguments['id'], FILTER_VALIDATE_INT) : false;
        $page = $id !== false && $id > 0 ? $this->pages->find((int) $id) : null;
        if ($id !== false && $id > 0 && $page === null) {
            return $this->responses->text('Page not found', 404);
        }

        $isEdit = $page !== null;
        $bootstrap = [
            'page' => $isEdit ? 'pages-edit' : 'pages-create',
            'csrfToken' => $this->csrf->token(),
            'sidebarWidth' => $this->settings->sidebarWidthForUser($user->id),
            'sidebarCollapsed' => $this->settings->sidebarCollapsedForUser($user->id),
            'collapsedSections' => $this->settings->collapsedSectionsForUser($user->id),
            'version' => $this->versions->current()->value,
            'pageData' => $page?->toPublicArray(),
        ];

        return $this->responses->html($this->views->render('admin/app.twig', [
            'title' => $isEdit ? 'Редактиране на страница' : 'Създаване на страница',
            'vite_tags' => $this->assets->tags(),
            'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
        ]));
    }
}
