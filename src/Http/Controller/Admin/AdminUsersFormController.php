<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Extensions\AdminExtensionRegistry;
use Flex\Http\View\ViteAssetManager;
use Flex\Session\CsrfTokenManager;
use Flex\Settings\SettingRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Users\User;
use Flex\Users\UserRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminUsersFormController
{
    public function __construct(
        private AuthenticationInterface $authentication,
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
        $actingUser = $this->authentication->user();
        if (!$actingUser instanceof AuthenticatedUser || !$actingUser->isSuperAdmin()) {
            return $this->responses->text('Достъпът е забранен.', 403);
        }

        $id = isset($arguments['id']) ? filter_var($arguments['id'], FILTER_VALIDATE_INT) : false;
        $user = is_int($id) && $id > 0 ? $this->users->find($id) : null;
        if ($id !== false && !$user instanceof User) {
            return $this->responses->text('Потребителят не е намерен.', 404);
        }

        $bootstrap = [
            'page' => $user instanceof User ? 'users-edit' : 'users-create',
            'csrfToken' => $this->csrf->token(),
            'sidebarWidth' => $this->settings->sidebarWidthForUser($actingUser->id),
            'sidebarCollapsed' => $this->settings->sidebarCollapsedForUser($actingUser->id),
            'collapsedSections' => $this->settings->collapsedSectionsForUser($actingUser->id),
            'version' => $this->versions->current()->value,
            'user' => $actingUser->toArray(),
            'userData' => $user instanceof User ? $user->identity()->toArray() : null,
            'adminExtensions' => $this->adminExtensions->bootstrap(),
        ];

        return $this->responses->html($this->views->render('admin/app.twig', [
            'title' => $user instanceof User ? 'Редактиране на потребител' : 'Създаване на потребител',
            'vite_tags' => $this->assets->tags(),
            'bootstrap_json' => json_encode($bootstrap, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
        ]));
    }
}
