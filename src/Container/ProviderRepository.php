<?php

declare(strict_types=1);

namespace Flex\Container;

use Flex\Container\Exception\ContainerException;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Container\ServiceProviderInterface;
use Psr\Container\ContainerInterface;

final class ProviderRepository
{
    /** @var list<ServiceProviderInterface> */
    private array $providers = [];

    public function __construct(ConfigRepositoryInterface $configuration)
    {
        foreach ($configuration->array('container.providers') as $providerClass) {
            if (!is_string($providerClass) || !class_exists($providerClass)) {
                throw new ContainerException('Every configured service provider must be an existing class.');
            }

            $provider = new $providerClass();
            if (!$provider instanceof ServiceProviderInterface) {
                throw new ContainerException(sprintf('Service provider "%s" must implement %s.', $providerClass, ServiceProviderInterface::class));
            }

            $this->providers[] = $provider;
        }
    }

    /** @return array<string, mixed> */
    public function definitions(): array
    {
        $definitions = [];
        foreach ($this->providers as $provider) {
            foreach ($provider->definitions() as $id => $definition) {
                if (array_key_exists($id, $definitions)) {
                    throw new ContainerException(sprintf('Container definition "%s" is registered by more than one service provider.', $id));
                }
                $definitions[$id] = $definition;
            }
        }

        return $definitions;
    }

    public function boot(ContainerInterface $container): void
    {
        foreach ($this->providers as $provider) {
            $provider->boot($container);
        }
    }
}
