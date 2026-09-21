<?php

declare(strict_types=1);

namespace Flex\Http\Middleware;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class MaintenanceModeMiddleware implements MiddlewareInterface
{
    public function __construct(
        private ProjectPaths $paths,
        private ResponseFactoryInterface $responses,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if ($request->getUri()->getPath() === '/health' || !is_file($this->paths->storage('maintenance.json'))) {
            return $handler->handle($request);
        }

        if ($this->expectsJson($request)) {
            return $this->responses->json(['status' => 'maintenance'], 503, ['Retry-After' => '60']);
        }

        return $this->responses->html(
            '<!doctype html><html lang="en"><meta charset="utf-8"><title>Maintenance</title><h1>Temporarily unavailable</h1><p>Flex CMS is being updated. Please try again shortly.</p>',
            503,
            ['Retry-After' => '60'],
        );
    }

    private function expectsJson(ServerRequestInterface $request): bool
    {
        return str_starts_with($request->getUri()->getPath(), '/api/')
            || str_contains(strtolower($request->getHeaderLine('Accept')), 'application/json');
    }
}
