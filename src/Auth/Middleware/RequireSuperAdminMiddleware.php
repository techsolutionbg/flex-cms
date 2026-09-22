<?php

declare(strict_types=1);

namespace Flex\Auth\Middleware;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\ApiError;
use Flex\Http\RequestFormat;
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
            if (!RequestFormat::expectsJson($request)) {
                return $this->responses->text('', 302, ['Location' => '/login']);
            }

            return $this->responses->json(ApiError::payload(401, 'authentication_required', 'Authentication required.'), 401);
        }
        if (!$user->isSuperAdmin()) {
            return $this->responses->json(ApiError::payload(403, 'super_admin_required', 'Super administrator access is required.'), 403);
        }

        return $handler->handle($request);
    }
}
