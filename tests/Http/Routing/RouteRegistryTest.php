<?php

declare(strict_types=1);

namespace Flex\Tests\Http\Routing;

use Flex\Http\Routing\RouteRegistry;
use Flex\Extensions\PluginRouteRegistrar;
use PHPUnit\Framework\TestCase;

final class RouteRegistryTest extends TestCase
{
    public function testItRegistersNormalizedRoutes(): void
    {
        $registry = new RouteRegistry();
        $registry->add(['get', 'head', 'get'], '/articles/{slug}', static fn() => null, 'articles.show');

        $routes = $registry->all();
        self::assertCount(1, $routes);
        self::assertSame(['GET', 'HEAD'], $routes[0]->methods);
        self::assertSame('/articles/{slug}', $routes[0]->path);
        self::assertSame('articles.show', $routes[0]->name);
    }

    public function testItRejectsDuplicateNamesAndLateRegistrations(): void
    {
        $registry = new RouteRegistry();
        $registry->get('/', static fn() => null, 'home');

        try {
            $registry->get('/other', static fn() => null, 'home');
            self::fail('A duplicate route name was expected to fail.');
        } catch (\InvalidArgumentException) {
            self::addToAssertionCount(1);
        }

        $registry->freeze();
        $this->expectException(\LogicException::class);
        $registry->post('/late', static fn() => null);
    }

    public function testPluginRoutesAreNamespaced(): void
    {
        $registry = new RouteRegistry();
        $registrar = new PluginRouteRegistrar($registry, 'acme/forms', ['routes.public']);

        $registrar->get('/health', static fn() => null, 'health');

        self::assertSame('/plugins/acme/forms/health', $registry->all()[0]->path);
        self::assertSame('plugin.acme_forms.health', $registry->all()[0]->name);
    }

    public function testPluginRoutesRejectTraversalPaths(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        (new PluginRouteRegistrar(new RouteRegistry(), 'acme/forms', ['routes.public']))->get('/../escape', static fn() => null);
    }

    public function testPluginRoutesRequireExplicitPermission(): void
    {
        $this->expectException(\Flex\Extensions\Exception\PluginPermissionDenied::class);

        (new PluginRouteRegistrar(new RouteRegistry(), 'acme/forms'))->get('/health', static fn() => null);
    }

    public function testPluginAdminRoutesRequirePermissionAndAuthentication(): void
    {
        $registry = new RouteRegistry();
        (new PluginRouteRegistrar($registry, 'acme/forms', ['routes.admin']))->admin('GET', '/settings', static fn() => null, 'settings');

        self::assertSame('/admin/plugins/acme/forms/settings', $registry->all()[0]->path);
        self::assertSame('plugin.admin.acme_forms.settings', $registry->all()[0]->name);
        self::assertSame([
            \Flex\Session\CsrfMiddleware::class,
            \Flex\Auth\Middleware\RequireAuthenticationMiddleware::class,
            \Flex\Auth\Middleware\RequireSuperAdminMiddleware::class,
        ], $registry->all()[0]->middleware);
    }

    public function testPluginAdminRoutesRejectMissingPermission(): void
    {
        $this->expectException(\Flex\Extensions\Exception\PluginPermissionDenied::class);

        (new PluginRouteRegistrar(new RouteRegistry(), 'acme/forms'))->admin('GET', '/settings', static fn() => null);
    }
}
