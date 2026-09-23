<?php

declare(strict_types=1);

namespace Flex\Providers;

use function DI\autowire;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Extensions\PluginManager;
use Flex\Extensions\PluginRegistry;
use Psr\Container\ContainerInterface;

final class ExtensionServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            PluginRegistry::class => autowire(),
            PluginManager::class => autowire(),
        ];
    }

    public function boot(ContainerInterface $container): void {}
}
