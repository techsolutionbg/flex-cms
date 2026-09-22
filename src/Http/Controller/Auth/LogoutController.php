<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Auth;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestFormat;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class LogoutController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $this->authentication->logout();
        if (RequestFormat::expectsJson($request)) {
            return $this->responses->text('', 204);
        }

        return $this->responses->text('', 302, ['Location' => '/login']);
    }
}
