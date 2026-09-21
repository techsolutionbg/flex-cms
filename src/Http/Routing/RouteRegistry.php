<?php

declare(strict_types=1);

namespace Flex\Http\Routing;

use Flex\Contracts\Http\RouteRegistryInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class RouteRegistry implements RouteRegistryInterface
{
    /** @var list<RouteDefinition> */
    private array $routes = [];

    /** @var array<string, true> */
    private array $names = [];

    private bool $frozen = false;

    public function add(
        string|array $methods,
        string $path,
        callable|array|string|RequestHandlerInterface $handler,
        ?string $name = null,
        array $middleware = [],
    ): void {
        if ($this->frozen) {
            throw new \LogicException('Routes cannot be registered after the router has been built.');
        }
        if ($path === '' || !str_starts_with($path, '/')) {
            throw new \InvalidArgumentException('Route paths must begin with "/".');
        }
        if ($name !== null && isset($this->names[$name])) {
            throw new \InvalidArgumentException(sprintf('Route name "%s" is already registered.', $name));
        }

        $normalizedMethods = is_array($methods)
            ? array_values(array_unique(array_map('strtoupper', $methods)))
            : strtoupper($methods);
        if ($normalizedMethods === '' || $normalizedMethods === []) {
            throw new \InvalidArgumentException('At least one HTTP method is required.');
        }

        $this->routes[] = new RouteDefinition($normalizedMethods, $path, $handler, $name, $middleware);
        if ($name !== null) {
            $this->names[$name] = true;
        }
    }

    public function get(string $path, callable|array|string|RequestHandlerInterface $handler, ?string $name = null): void
    {
        $this->add('GET', $path, $handler, $name);
    }

    public function post(string $path, callable|array|string|RequestHandlerInterface $handler, ?string $name = null): void
    {
        $this->add('POST', $path, $handler, $name);
    }

    /** @return list<RouteDefinition> */
    public function all(): array
    {
        return $this->routes;
    }

    public function freeze(): void
    {
        $this->frozen = true;
    }
}
