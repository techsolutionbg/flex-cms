<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Users;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Users\UserService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class CreateUserController
{
    public function __construct(
        private RequestInput $input,
        private UserService $users,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->users->create($this->input->all($request));

        return $this->responses->json(['user' => $user->identity()->toArray()], 201);
    }
}
