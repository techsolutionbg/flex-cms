<?php

declare(strict_types=1);

namespace Flex\Http\Routing;

use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class RouteDefinition
{
    /**
     * @param string|list<string> $methods
     * @param callable|array{class-string, string}|class-string|RequestHandlerInterface $handler
     * @param list<class-string<MiddlewareInterface>|MiddlewareInterface> $middleware
     */
    public function __construct(
        public string|array $methods,
        public string $path,
        public mixed $handler,
        public ?string $name,
        public array $middleware,
    ) {}
}
