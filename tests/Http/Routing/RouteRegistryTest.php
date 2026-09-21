<?php

declare(strict_types=1);

namespace Flex\Tests\Http\Routing;

use Flex\Http\Routing\RouteRegistry;
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
}
