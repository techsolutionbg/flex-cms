<?php

declare(strict_types=1);

namespace Flex\Contracts\Container;

use Psr\Container\ContainerInterface;

interface ServiceProviderInterface
{
    /** @return array<string, mixed> */
    public function definitions(): array;

    public function boot(ContainerInterface $container): void;
}
