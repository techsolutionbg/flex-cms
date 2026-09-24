<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Extensions\PluginManager;
use Flex\Http\ApiError;
use Flex\Http\RequestInput;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminPluginActionController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private PluginManager $plugins,
        private RequestInput $input,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(ApiError::payload(403, 'super_admin_required', 'Super administrator access is required.'), 403);
        }

        $input = $this->input->all($request);
        $id = $input['id'] ?? null;
        $action = $input['action'] ?? null;
        if (!is_string($id) || $id === '' || !is_string($action) || !in_array($action, ['install', 'activate', 'deactivate', 'uninstall', 'approve_permissions'], true)) {
            return $this->responses->json(ApiError::payload(422, 'validation_failed', 'A valid plugin ID and action are required.'), 422);
        }

        try {
            if ($action === 'approve_permissions') {
                $permissions = $input['permissions'] ?? [];
                if (!is_array($permissions)) {
                    return $this->responses->json(ApiError::payload(422, 'validation_failed', 'Permissions must be an array.'), 422);
                }
                /** @var list<string> $permissions */
                $plugin = $this->plugins->approvePermissions($id, $permissions);
            } elseif ($action === 'install') {
                $plugin = $this->plugins->install($id);
            } elseif ($action === 'activate') {
                $plugin = $this->plugins->activate($id);
            } elseif ($action === 'deactivate') {
                $plugin = $this->plugins->deactivate($id);
            } else {
                $this->plugins->uninstall($id);
                return $this->responses->json(['message' => 'Plugin uninstalled.']);
            }
        } catch (\Throwable $exception) {
            return $this->responses->json(ApiError::payload(422, 'plugin_action_failed', $exception->getMessage()), 422);
        }

        return $this->responses->json(['plugin' => $plugin->toPublicArray()]);
    }
}
