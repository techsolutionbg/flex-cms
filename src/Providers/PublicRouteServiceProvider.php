<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Http\Controller\PublicContactFormController;
use Flex\Http\Controller\PublicPageController;
use Flex\Menus\PublicMenuRenderer;
use Flex\Pages\HomePageResolver;
use Flex\Session\CsrfMiddleware;
use Flex\Settings\SectionSettings;
use Psr\Container\ContainerInterface;

use function DI\autowire;
use function DI\get;

final class PublicRouteServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            PublicPageController::class => autowire()
                ->constructorParameter('media', get(\Flex\Media\PublicMediaApi::class))
                ->constructorParameter('csrf', get(\Flex\Session\CsrfTokenManager::class))
                ->constructorParameter('homePages', get(HomePageResolver::class)),
            PublicContactFormController::class => autowire(),
            // The page served at "/" — shared by the public controller and menu links, so both agree.
            HomePageResolver::class => autowire()->constructorParameter('siteSettings', get(SectionSettings::class)),
            PublicMenuRenderer::class => autowire()->constructorParameter('homePages', get(HomePageResolver::class)),
        ];
    }

    public function boot(ContainerInterface $container): void
    {
        $routes = $container->get(RouteRegistryInterface::class);
        $routes->add(['GET', 'HEAD'], '/media-files/{id:number}/{variant}', \Flex\Http\Controller\PublicMediaController::class, 'public.media');
        $routes->get('/', PublicPageController::class, 'home');
        $routes->add('POST', '/contact-submit', PublicContactFormController::class, 'public.contact.submit', [CsrfMiddleware::class]);
        $routes->get('/{slug:.+}', PublicPageController::class, 'public.page');
    }
}
