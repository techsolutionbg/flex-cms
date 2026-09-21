<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Users;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Users\UserService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class DeleteUserController
{
    public function __construct(
        private UserService $users,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $actingUser = $request->getAttribute('auth.user');
        if (!$actingUser instanceof AuthenticatedUser) {
            throw new \LogicException('The authenticated user context is missing.');
        }
        $id = filter_var($arguments['id'] ?? null, FILTER_VALIDATE_INT);
        if (!is_int($id) || $id < 1) {
            throw new \InvalidArgumentException('User ID is invalid.');
        }

        $this->users->delete($id, $actingUser->id);

        return $this->responses->text('', 204);
    }
}
