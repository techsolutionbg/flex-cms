<?php

declare(strict_types=1);

namespace Flex\Container;

use DI\ContainerBuilder;
use Flex\Configuration\ConfigurationCache;
use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Container\Exception\ContainerException;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Psr\Container\ContainerInterface;
use function DI\create;
use function DI\get;

final readonly class ContainerFactory
{
    public function __construct(
        private string $basePath,
        private ConfigRepositoryInterface $configuration,
    ) {
    }

    public function build(): ContainerInterface
    {
        $providers = new ProviderRepository($this->configuration);
        $builder = new ContainerBuilder();
        $builder->useAutowiring(true);
        $builder->useAttributes(false);

        if ($this->configuration->bool('container.compile')) {
            $directory = $this->basePath . '/storage/cache/container';
            if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
                throw new ContainerException('The compiled container cache directory cannot be created.');
            }
            $builder->enableCompilation($directory);
        }

        $builder->addDefinitions([
            'base_path' => $this->basePath,
            'config.values' => $this->configuration->all(),
            ConfigRepositoryInterface::class => create(ConfigurationRepository::class)
                ->constructor(get('config.values')),
            ProjectPaths::class => create()
                ->constructor(get('base_path'), get(ConfigRepositoryInterface::class)),
            ConfigurationCache::class => create()
                ->constructor(get('base_path'), get(ConfigRepositoryInterface::class)),
        ]);
        $builder->addDefinitions($providers->definitions());

        try {
            $container = $builder->build();
        } catch (\Throwable $exception) {
            throw new ContainerException('The service container could not be built.', 0, $exception);
        }

        $providers->boot($container);

        return $container;
    }
}
