<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\ApiError;
use Flex\Http\RequestInput;
use Flex\Themes\ThemeManager;
use Flex\Updates\Remote\RemoteThemeInstaller;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminThemeActionController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ThemeManager $themes,
        private RequestInput $input,
        private ResponseFactoryInterface $responses,
        private RemoteThemeInstaller $remoteInstaller,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(ApiError::payload(403, 'super_admin_required', 'Необходим е достъп на супер администратор.'), 403);
        }
        $input = $this->input->all($request);
        $action = $input['action'] ?? null;
        try {
        $theme = $action === 'install_remote' && is_string($input['id'] ?? null)
            ? $this->remoteInstaller->install($input['id'])
            : ($action === 'update_remote' && is_string($input['id'] ?? null)
            ? $this->remoteInstaller->update($input['id'])
            : ($action === 'activate' && is_string($input['id'] ?? null)
            ? $this->themes->activate($input['id'])
            : ($action === 'deactivate' && is_string($input['id'] ?? null)
            ? $this->themes->deactivate($input['id'])
            : ($action === 'delete' && is_string($input['id'] ?? null)
            ? $this->themes->delete($input['id'])
            : ($action === 'rollback' ? $this->themes->rollback() : throw new \InvalidArgumentException('Изберете валидно действие за тема.'))))));
        } catch (\Throwable $exception) {
            return $this->responses->json(ApiError::payload(422, 'theme_action_failed', $exception->getMessage()), 422);
        }

        return $this->responses->json(['theme' => $theme, 'themes' => $this->themes->all()]);
    }
}
