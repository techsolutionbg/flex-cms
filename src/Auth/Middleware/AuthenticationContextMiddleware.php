<?php

declare(strict_types=1);

namespace Flex\Auth\Middleware;

use Flex\Contracts\Auth\AuthenticationInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class AuthenticationContextMiddleware implements MiddlewareInterface
{
    public function __construct(
        private AuthenticationInterface $authentication,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if ($request->getUri()->getPath() === '/health' || preg_match('#^/media-files/[0-9]+/(original|thumbnail)$#D', $request->getUri()->getPath()) === 1) {
            return $handler->handle($request);
        }

        return $handler->handle($request->withAttribute('auth.user', $this->authentication->user()));
    }
}
