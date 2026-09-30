<?php

declare(strict_types=1);

namespace Flex\Auth\Middleware;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Session\SessionInterface;
use Flex\Http\ApiError;
use Flex\Http\RequestFormat;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class RequireAuthenticationMiddleware implements MiddlewareInterface
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ResponseFactoryInterface $responses,
        private SessionInterface $session,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if ($this->authentication->check()) {
            return $handler->handle($request);
        }
        if (RequestFormat::expectsJson($request)) {
            return $this->responses->json(ApiError::payload(401, 'authentication_required', 'Необходимо е вписване.'), 401);
        }

        if ($request->getMethod() === 'GET') {
            $path = $request->getUri()->getPath();
            $query = $request->getUri()->getQuery();
            $location = $path . ($query !== '' ? '?' . $query : '');
            if ($path !== '' && $path !== '/login' && str_starts_with($location, '/') && !str_starts_with($location, '//')) {
                $this->session->put('auth.intended_url', $location);
            }
        }

        return $this->responses->text('', 302, ['Location' => '/login']);
    }

}
