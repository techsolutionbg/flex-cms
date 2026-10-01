<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Users;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Users\UserService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class RestoreUserController
{
    public function __construct(private UserService $users, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $id = filter_var($arguments['id'] ?? null, FILTER_VALIDATE_INT);
        if (!is_int($id) || $id < 1) throw new \InvalidArgumentException('User ID is invalid.');
        $user = $this->users->restore($id);

        return $this->responses->json(['user' => [...$user->identity()->toArray(), 'deleted_at' => null]]);
    }
}

