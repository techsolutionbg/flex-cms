<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Users;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Users\UserService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class UpdateUserController
{
    public function __construct(
        private RequestInput $input,
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

        $user = $this->users->update($id, $this->input->all($request), $actingUser->id);

        return $this->responses->json(['user' => $user->identity()->toArray()]);
    }
}
