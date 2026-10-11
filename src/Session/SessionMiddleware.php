<?php

declare(strict_types=1);

namespace Flex\Session;

use Flex\Contracts\Session\SessionInterface;
use Flex\Http\StatelessPaths;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class SessionMiddleware implements MiddlewareInterface
{
    public function __construct(
        private SessionInterface $session,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (StatelessPaths::matches($request->getUri()->getPath())) {
            return $handler->handle($request);
        }

        $this->session->start();

        return $handler->handle($request->withAttribute(SessionInterface::class, $this->session));
    }
}
