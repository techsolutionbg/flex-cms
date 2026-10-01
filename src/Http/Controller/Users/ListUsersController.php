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
    public function __construct(private UserRepository $users, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $view = ($request->getQueryParams()['view'] ?? 'active') === 'trash' ? 'trash' : 'active';
        $users = $view === 'trash' ? $this->users->trashed() : $this->users->all();

        return $this->responses->json([
            'view' => $view,
            'users' => $users->map(static fn(User $user): array => [
                ...$user->identity()->toArray(),
                'deleted_at' => $user->getAttribute('deleted_at')?->toIso8601String(),
            ])->all(),
        ]);
    }
}
