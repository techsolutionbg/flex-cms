<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extensions\PluginRegistry;
use Flex\Pages\PageRepository;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Flex\Users\UserRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminDashboardSummaryController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private PageRepository $pages,
        private PluginRegistry $plugins,
        private UserRepository $users,
        private PlatformVersionRegistry $versions,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['status' => 403, 'message' => 'Достъпът е забранен.']], 403);
        }

        $plugins = $this->plugins->all();

        return $this->responses->json([
            'pages' => $this->pages->all()->count(),
            'active_plugins' => $plugins->filter(static fn($plugin): bool => $plugin->getAttribute('status') === 'active')->count(),
            'users' => $this->users->all()->count(),
            'version' => $this->versions->current()->value,
        ]);
    }
}
