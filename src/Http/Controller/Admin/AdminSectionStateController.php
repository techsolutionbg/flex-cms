<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\ApiError;
use Flex\Http\RequestInput;
use Flex\Settings\SettingRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminSectionStateController
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

        $values = $this->input->all($request);
        $key = $values['key'] ?? null;
        $collapsedValue = $values['collapsed'] ?? null;
        $collapsed = filter_var($collapsedValue, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
        if (!is_string($key) || !preg_match('/^[a-z0-9-]+$/', $key) || $collapsed === null) {
            return $this->responses->json(ApiError::payload(422, 'validation_failed', 'Section state is invalid.'), 422);
        }

        return $this->responses->json([
            'key' => $key,
            'collapsed' => $this->settings->saveCollapsedSectionForUser($user->id, $key, $collapsed),
        ]);
    }
}
