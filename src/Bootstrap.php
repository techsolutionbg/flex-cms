<?php

declare(strict_types=1);

namespace Flex;

use Flex\Configuration\ConfigurationLoader;
use Flex\Configuration\EnvironmentLoader;
use Flex\Configuration\EnvironmentValidator;
use Flex\Container\ContainerFactory;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Psr\Container\ContainerInterface;

final readonly class Bootstrap
{
    private function __construct(
        private ContainerInterface $container,
    ) {}

    public static function boot(string $basePath): self
    {
        (new EnvironmentLoader())->load($basePath);
        $useCache = filter_var($_ENV['APP_CONFIG_CACHE'] ?? false, FILTER_VALIDATE_BOOL);
        $configuration = (new ConfigurationLoader())->load($basePath, $useCache);
        (new EnvironmentValidator())->validate($configuration);
        $container = (new ContainerFactory($basePath, $configuration))->build();

        return new self($container);
    }

    public function container(): ContainerInterface
    {
        return $this->container;
    }

    public function configuration(): ConfigRepositoryInterface
    {
        return $this->container->get(ConfigRepositoryInterface::class);
    }
}
