<?php

declare(strict_types=1);

namespace Flex\Providers;

use Flex\Application;
use Flex\Configuration\ConfigurationRedactor;
use Flex\Configuration\EnvironmentValidator;
use Flex\Console\FlexConsoleApplication;
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Logging\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;

use function DI\autowire;
use function DI\create;
use function DI\factory;

final class CoreServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [EnvironmentValidator::class => create(), ConfigurationRedactor::class => create(), LoggerFactory::class => autowire(), LoggerInterface::class => factory([LoggerFactory::class, 'create']), Application::class => autowire(), FlexConsoleApplication::class => autowire()];
    }
    public function boot(ContainerInterface $container): void
    {
    }
}
