<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Auth;

use Flex\Auth\Exception\TooManyLoginAttempts;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\ApiError;
use Flex\Http\RequestInput;
use Flex\Session\CsrfTokenManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class LoginController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private RequestInput $input,
        private CsrfTokenManager $csrf,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $input = $this->input->all($request);
        $email = is_string($input['email'] ?? null) ? $input['email'] : '';
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        $ipAddress = $request->getServerParams()['REMOTE_ADDR'] ?? 'unknown';
        $ipAddress = is_string($ipAddress) ? $ipAddress : 'unknown';

        try {
            $authenticated = $this->authentication->attempt($email, $password, $ipAddress);
        } catch (TooManyLoginAttempts $exception) {
            return $this->failure($request, $exception->getMessage(), 429, ['Retry-After' => '900']);
        }
        if (!$authenticated) {
            return $this->failure($request, 'Невалиден имейл или парола.', 401);
        }

        $this->csrf->rotate();
        return $this->responses->json(['user' => $this->authentication->user()?->toArray()]);
    }

    /** @param array<string, string|list<string>> $headers */
    private function failure(ServerRequestInterface $request, string $message, int $status, array $headers = []): ResponseInterface
    {
        $code = $status === 429 ? 'too_many_login_attempts' : 'invalid_credentials';
        return $this->responses->json(ApiError::payload($status, $code, $message), $status, $headers);
    }

}
