<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Database\DatabaseManager;
use Psr\Container\ContainerInterface;

use function DI\autowire;

final class DatabaseServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            DatabaseManager::class => autowire(),
        ];
    }

    public function boot(ContainerInterface $container): void
    {
        $container->get(DatabaseManager::class)->boot();
    }
}
