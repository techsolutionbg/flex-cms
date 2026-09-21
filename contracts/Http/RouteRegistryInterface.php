<?php

declare(strict_types=1);

namespace Flex\Contracts\Http;

use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

interface RouteRegistryInterface
{
    /**
     * @param string|list<string> $methods
     * @param callable|array{class-string, string}|class-string|RequestHandlerInterface $handler
     * @param list<class-string<MiddlewareInterface>|MiddlewareInterface> $middleware
     */
    public function add(
        string|array $methods,
        string $path,
        callable|array|string|RequestHandlerInterface $handler,
        ?string $name = null,
        array $middleware = [],
    ): void;

    /** @param callable|array{class-string, string}|class-string|RequestHandlerInterface $handler */
    public function get(string $path, callable|array|string|RequestHandlerInterface $handler, ?string $name = null): void;

    /** @param callable|array{class-string, string}|class-string|RequestHandlerInterface $handler */
    public function post(string $path, callable|array|string|RequestHandlerInterface $handler, ?string $name = null): void;
}
