<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Users;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Mail\EmailVerificationService;
use Flex\Users\UserService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class CreateUserController
{
    public function __construct(
        private RequestInput $input,
        private UserService $users,
        private EmailVerificationService $verification,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $input = $this->input->all($request);
        $user = $this->users->create($input);
        $confirmationSent = filter_var($input['send_confirmation'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($confirmationSent) {
            $this->verification->sendCode($user);
        }

        return $this->responses->json(['user' => $user->identity()->toArray(), 'confirmation_sent' => $confirmationSent], 201);
    }
}
