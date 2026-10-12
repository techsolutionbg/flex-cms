<?php

declare(strict_types=1);

namespace Flex\Http\Middleware;

use Flex\Extension\V1\ExtensionApiInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** Allows active extensions to set response policies after their content renders. */
final readonly class ExtensionResponseMiddleware implements MiddlewareInterface
{
    public function __construct(private ExtensionApiInterface $api) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $response = $handler->handle($request);
        $filtered = $this->api->applyFilters('http.response', $response, ['request' => $request]);
        return $filtered instanceof ResponseInterface ? $filtered : $response;
    }
}
