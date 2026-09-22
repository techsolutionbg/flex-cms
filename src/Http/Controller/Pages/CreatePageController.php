<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Pages;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Pages\PageService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class CreatePageController
{
    public function __construct(private RequestInput $input, private PageService $pages, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $request->getAttribute('auth.user');
        if (!$user instanceof AuthenticatedUser) {
            return $this->responses->json(['error' => 'Authentication required.'], 401);
        }

        return $this->responses->json(['page' => $this->pages->create($this->input->all($request), $user->id)->toPublicArray()], 201);
    }
}
