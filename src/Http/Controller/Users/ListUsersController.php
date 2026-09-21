<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Users;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Users\User;
use Flex\Users\UserRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class ListUsersController
{
    public function __construct(
        private UserRepository $users,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        return $this->responses->json([
            'users' => $this->users->all()->map(
                static fn(User $user): array => $user->identity()->toArray(),
            )->all(),
        ]);
    }
}
