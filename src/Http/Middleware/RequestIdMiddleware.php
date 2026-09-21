<?php

declare(strict_types=1);

namespace Flex\Http\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class RequestIdMiddleware implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $requestId = $request->getHeaderLine('X-Request-ID');
        if (preg_match('/^[a-zA-Z0-9._-]{8,128}$/', $requestId) !== 1) {
            $requestId = bin2hex(random_bytes(16));
        }

        $response = $handler->handle($request->withAttribute('request_id', $requestId));

        return $response->withHeader('X-Request-ID', $requestId);
    }
}
