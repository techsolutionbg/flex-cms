<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\PublicPageController;
use Psr\Container\ContainerInterface;

use function DI\autowire;
use function DI\get;

final class PublicRouteServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [PublicPageController::class => autowire()->constructorParameter('media', get(\Flex\Media\PublicMediaApi::class))];
    }

    public function boot(ContainerInterface $container): void
    {
        $routes = $container->get(RouteRegistryInterface::class);
        $routes->add(['GET', 'HEAD'], '/media-files/{id:number}/{variant}', \Flex\Http\Controller\PublicMediaController::class, 'public.media');
        $routes->get('/', PublicPageController::class, 'home');
        $routes->get('/{slug:.+}', PublicPageController::class, 'public.page');
    }
}
