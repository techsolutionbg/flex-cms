<?php

declare(strict_types=1);

namespace Flex\Auth\Middleware;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class RequireAuthenticationMiddleware implements MiddlewareInterface
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ResponseFactoryInterface $responses,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if ($this->authentication->check()) {
            return $handler->handle($request);
        }
        if ($this->expectsJson($request)) {
            return $this->responses->json(['error' => ['status' => 401, 'message' => 'Authentication required.']], 401);
        }

        return $this->responses->text('', 302, ['Location' => '/login']);
    }

    private function expectsJson(ServerRequestInterface $request): bool
    {
        return str_starts_with($request->getUri()->getPath(), '/api/')
            || str_contains(strtolower($request->getHeaderLine('Accept')), 'application/json');
    }
}
