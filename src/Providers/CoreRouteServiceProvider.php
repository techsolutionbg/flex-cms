<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\{ExtensionFrontendAssetController, HealthController, HomeController};
use Psr\Container\ContainerInterface;

final class CoreRouteServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [];
    } public function boot(ContainerInterface $container): void
    {
        $routes = $container->get(RouteRegistryInterface::class);
        $routes->get('/', HomeController::class, 'home');
        $routes->get('/health', HealthController::class, 'health');
        $routes->get('/extensions/{id}/assets/{asset:.+}', ExtensionFrontendAssetController::class, 'extension.frontend.asset');
    }
}
