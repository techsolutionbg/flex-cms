<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Pages\PageRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminPagesDataController
{
    public function __construct(private AuthenticationInterface $authentication, private PageRepository $pages, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['status' => 403, 'message' => 'Достъпът е забранен.']], 403);
        }

        $view = (string) ($request->getQueryParams()['view'] ?? 'active');
        $pages = $view === 'trash' ? $this->pages->trashed() : $this->pages->all();

        return $this->responses->json(['view' => $view === 'trash' ? 'trash' : 'active', 'pages' => $pages->map(static fn(\Flex\Pages\Page $page): array => $page->toPublicArray())->all()]);
    }
}
