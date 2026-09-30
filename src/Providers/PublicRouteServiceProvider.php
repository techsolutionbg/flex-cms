<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\PublicPageController;
use Psr\Container\ContainerInterface;

final class PublicRouteServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [];
    }

    public function boot(ContainerInterface $container): void
    {
        $routes = $container->get(RouteRegistryInterface::class);
        $routes->get('/', PublicPageController::class, 'home');
        $routes->get('/{slug:.+}', PublicPageController::class, 'public.page');
    }
}
