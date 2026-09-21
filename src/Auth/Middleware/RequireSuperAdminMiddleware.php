<?php

declare(strict_types=1);

namespace Flex\Auth\Middleware;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class RequireSuperAdminMiddleware implements MiddlewareInterface
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ResponseFactoryInterface $responses,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $user = $this->authentication->user();
        if ($user === null) {
            return $this->responses->json(['error' => ['status' => 401, 'message' => 'Authentication required.']], 401);
        }
        if (!$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['status' => 403, 'message' => 'Super administrator access is required.']], 403);
        }

        return $handler->handle($request);
    }
}
