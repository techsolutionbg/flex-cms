<?php

declare(strict_types=1);

namespace Flex\Http;

use Flex\Container\Exception\ContainerException;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Http\Routing\RouterFactory;
use Flex\Extensions\PluginRuntime;
use Psr\Container\ContainerInterface;
use Psr\Http\Server\MiddlewareInterface;

final readonly class ApplicationKernelFactory
{
    public function __construct(
        private ContainerInterface $container,
        private ConfigRepositoryInterface $configuration,
        private RouterFactory $routers,
    ) {}

    public function create(): ApplicationKernel
    {
        // Active plugins register their routes, events and content blocks after all
        // core route providers have finished and before the router is frozen.
        $this->container->get(PluginRuntime::class)->bootActive();
        $middleware = [];
        foreach ($this->configuration->array('http.middleware') as $serviceId) {
            if (!is_string($serviceId)) {
                throw new ContainerException('Every HTTP middleware entry must be a container service ID.');
            }
            $service = $this->container->get($serviceId);
            if (!$service instanceof MiddlewareInterface) {
                throw new ContainerException(sprintf('HTTP middleware "%s" must implement %s.', $serviceId, MiddlewareInterface::class));
            }
            $middleware[] = $service;
        }

        return new ApplicationKernel($this->routers->create(), $middleware);
    }
}
