<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Themes\ThemeManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminThemeCapabilitiesController
{
    public function __construct(private AuthenticationInterface $authentication, private ThemeManager $themes, private ResponseFactoryInterface $responses) {}

    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        }
        $capabilities = $this->themes->capabilities();
        return $this->responses->json($capabilities, 200, ['Cache-Control' => 'no-store']);
    }
}
