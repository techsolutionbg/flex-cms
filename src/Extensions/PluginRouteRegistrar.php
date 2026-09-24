<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Extension\V1\PluginRouteRegistrarInterface;
use Flex\Extensions\Exception\PluginPermissionDenied;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Http\Server\MiddlewareInterface;
use Flex\Auth\Middleware\RequireAuthenticationMiddleware;
use Flex\Auth\Middleware\RequireSuperAdminMiddleware;
use Flex\Session\CsrfMiddleware;

final readonly class PluginRouteRegistrar implements PluginRouteRegistrarInterface
{
    /** @param list<string> $permissions */
    public function __construct(private RouteRegistryInterface $routes, private string $pluginId, private array $permissions = []) {}

    /**
     * @param string|list<string> $methods
     * @param callable|array{class-string, string}|class-string|RequestHandlerInterface $handler
     * @param list<class-string<MiddlewareInterface>|MiddlewareInterface> $middleware
     */
    public function add(string|array $methods, string $path, callable|array|string|RequestHandlerInterface $handler, ?string $name = null, array $middleware = []): void
    {
        if (!PluginPermissions::allows($this->permissions, PluginPermissions::ROUTES_PUBLIC)) {
            throw new PluginPermissionDenied(sprintf('Plugin "%s" requires the "%s" permission to register routes.', $this->pluginId, PluginPermissions::ROUTES_PUBLIC));
        }
        if ($path === '' || !str_starts_with($path, '/') || str_contains($path, '..') || str_starts_with($path, '//')) {
            throw new \InvalidArgumentException('Plugin route paths must be rooted paths without traversal segments.');
        }

        $prefix = '/plugins/' . trim($this->pluginId, '/');
        $routeName = $name === null ? null : 'plugin.' . str_replace(['/', '.'], '_', $this->pluginId) . '.' . ltrim($name, '.');
        /** @var callable|array{class-string, string}|class-string|RequestHandlerInterface $handler */
        $this->routes->add($methods, rtrim($prefix, '/') . $path, $handler, $routeName, $middleware);
    }

    /** @param list<class-string<MiddlewareInterface>|MiddlewareInterface> $middleware */
    public function get(string $path, callable|array|string|RequestHandlerInterface $handler, ?string $name = null, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $name, $middleware);
    }

    /** @param list<class-string<MiddlewareInterface>|MiddlewareInterface> $middleware */
    public function post(string $path, callable|array|string|RequestHandlerInterface $handler, ?string $name = null, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $name, $middleware);
    }

    public function admin(string|array $methods, string $path, callable|array|string|RequestHandlerInterface $handler, ?string $name = null, array $middleware = []): void
    {
        if (!PluginPermissions::allows($this->permissions, PluginPermissions::ROUTES_ADMIN)) {
            throw new PluginPermissionDenied(sprintf('Plugin "%s" requires the "%s" permission to register admin routes.', $this->pluginId, PluginPermissions::ROUTES_ADMIN));
        }
        if ($path === '' || !str_starts_with($path, '/') || str_contains($path, '..') || str_starts_with($path, '//')) {
            throw new \InvalidArgumentException('Plugin route paths must be rooted paths without traversal segments.');
        }

        $prefix = '/admin/plugins/' . trim($this->pluginId, '/');
        $routeName = $name === null ? null : 'plugin.admin.' . str_replace(['/', '.'], '_', $this->pluginId) . '.' . ltrim($name, '.');
        $this->routes->add($methods, rtrim($prefix, '/') . $path, $handler, $routeName, [CsrfMiddleware::class, RequireAuthenticationMiddleware::class, RequireSuperAdminMiddleware::class, ...$middleware]);
    }
}
