<?php

declare(strict_types=1);

namespace Flex\Providers;

use function DI\autowire;
use function DI\get;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Extensions\ExtensionApi;
use Flex\Extensions\FrontendExtensionAssets;
use Flex\Extensions\AdminExtensionRegistry;
use Flex\Extensions\ContentBlockRegistry;
use Flex\Extensions\PageFieldRegistry;
use Flex\Extensions\PageSettingsRegistry;
use Flex\Extensions\PluginRouteRegistrar;
use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginEntrypointLoader;
use Flex\Extensions\PluginRegistry;
use Flex\Extensions\PluginRuntime;
use Flex\Contracts\Http\RouteRegistryInterface;
use Flex\Pages\PageService;
use Psr\Container\ContainerInterface;

final class ExtensionServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            PluginRegistry::class => autowire(),
            PluginEntrypointLoader::class => autowire(),
            ExtensionApi::class => autowire(),
            ExtensionApiInterface::class => get(ExtensionApi::class),
            PluginManager::class => autowire()
                ->constructorParameter('contentBlocks', get(ContentBlockRegistry::class))
                ->constructorParameter('adminExtensions', get(AdminExtensionRegistry::class))
                ->constructorParameter('pageFields', get(PageFieldRegistry::class))
                ->constructorParameter('pageSettings', get(PageSettingsRegistry::class)),
            PluginRuntime::class => autowire()
                ->constructorParameter('contentBlocks', get(ContentBlockRegistry::class))
                ->constructorParameter('adminExtensions', get(AdminExtensionRegistry::class))
                ->constructorParameter('pageFields', get(PageFieldRegistry::class))
                ->constructorParameter('pageSettings', get(PageSettingsRegistry::class))
                ->constructorParameter('routes', get(RouteRegistryInterface::class)),
            PageService::class => autowire()
                ->constructorParameter('contentBlocks', get(ContentBlockRegistry::class))
                ->constructorParameter('pageFields', get(PageFieldRegistry::class))
                ->constructorParameter('pageSettings', get(PageSettingsRegistry::class)),
            ContentBlockRegistry::class => autowire(),
            AdminExtensionRegistry::class => autowire(),
            PageFieldRegistry::class => autowire(),
            PageSettingsRegistry::class => autowire(),
            FrontendExtensionAssets::class => autowire(),
            PluginRouteRegistrar::class => autowire(),
        ];
    }

    public function boot(ContainerInterface $container): void {}
}
