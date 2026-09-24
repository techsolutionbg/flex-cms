<?php

declare(strict_types=1);

namespace Flex\Providers;

use function DI\autowire;
use function DI\get;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Extension\V1\ExtensionApiInterface;
use Flex\Extensions\ExtensionApi;
use Flex\Extensions\FrontendExtensionAssets;
use Flex\Extensions\PluginRouteRegistrar;
use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginEntrypointLoader;
use Flex\Extensions\PluginRegistry;
use Flex\Extensions\PluginRuntime;
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
            PluginManager::class => autowire(),
            PluginRuntime::class => autowire(),
            ContentBlockRegistry::class => autowire(),
            FrontendExtensionAssets::class => autowire(),
            PluginRouteRegistrar::class => autowire(),
        ];
    }

    public function boot(ContainerInterface $container): void {}
}
