<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Http\ApiError;
use Flex\Settings\SettingRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminSidebarWidthController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private RequestInput $input,
        private SettingRepository $settings,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(ApiError::payload(403, 'super_admin_required', 'Super administrator access is required.'), 403);
        }

        $value = $this->input->all($request)['width'] ?? null;
        if (!is_int($value) && !is_string($value)) {
            return $this->responses->json(ApiError::payload(422, 'validation_failed', 'Sidebar width must be an integer.', ['fields' => ['width' => ['Must be an integer.']]]), 422);
        }
        if (filter_var($value, FILTER_VALIDATE_INT) === false) {
            return $this->responses->json(ApiError::payload(422, 'validation_failed', 'Sidebar width must be an integer.', ['fields' => ['width' => ['Must be an integer.']]]), 422);
        }

        return $this->responses->json([
            'width' => $this->settings->saveSidebarWidthForUser($user->id, (int) $value),
        ]);
    }
}
