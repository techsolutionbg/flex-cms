<?php

declare(strict_types=1);

namespace Flex\Http\Routing;

use League\Route\Router;
use League\Route\Strategy\ApplicationStrategy;
use Psr\Container\ContainerInterface;
use Psr\Http\Server\MiddlewareInterface;

final readonly class RouterFactory
{
    public function __construct(
        private ContainerInterface $container,
        private RouteRegistry $routes,
    ) {}

    public function create(): Router
    {
        $strategy = new ApplicationStrategy();
        $strategy->setContainer($this->container);
        $router = new Router();
        $router->setStrategy($strategy);

        $definitions = $this->routes->all();
        // Public pages are a fallback. Plugins boot after the core route providers.
        usort($definitions, static fn(RouteDefinition $a, RouteDefinition $b): int =>
            (int) ($a->name === 'public.page') <=> (int) ($b->name === 'public.page'));
        foreach ($definitions as $definition) {
            $route = $router->map($definition->methods, $definition->path, $definition->handler);
            if ($definition->name !== null) {
                $route->setName($definition->name);
            }
            foreach ($definition->middleware as $middleware) {
                if (is_string($middleware)) {
                    $route->lazyMiddleware($middleware);
                } elseif ($middleware instanceof MiddlewareInterface) {
                    $route->middleware($middleware);
                }
            }
        }

        $this->routes->freeze();

        return $router;
    }
}
