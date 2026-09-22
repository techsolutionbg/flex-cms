<?php

declare(strict_types=1);

namespace Flex\Providers;

use function DI\autowire;

use Flex\Auth\AuthenticationManager;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Contracts\Session\SessionInterface;
use Flex\Session\NativeSession;
use Psr\Container\ContainerInterface;

final class AuthServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [SessionInterface::class => autowire(NativeSession::class), AuthenticationInterface::class => autowire(AuthenticationManager::class)];
    }
    public function boot(ContainerInterface $container): void {}
}
