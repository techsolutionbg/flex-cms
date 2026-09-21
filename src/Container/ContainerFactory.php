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
    ) {}

    public function build(): ContainerInterface
    {
        $providers = new ProviderRepository($this->configuration);
        $builder = new ContainerBuilder();
        $builder->useAutowiring(true);
        $builder->useAttributes(false);

        if ($this->configuration->bool('container.compile')) {
            $cacheKey = $this->compilationCacheKey();
            $directory = $this->basePath . '/storage/cache/container/' . $cacheKey;
            if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
                throw new ContainerException('The compiled container cache directory cannot be created.');
            }
            $builder->enableCompilation($directory, 'CompiledContainer_' . $cacheKey);
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

    private function compilationCacheKey(): string
    {
        $deploymentFingerprint = '';
        foreach (['platform.json', 'composer.lock'] as $file) {
            $path = $this->basePath . '/' . $file;
            if (is_file($path)) {
                $deploymentFingerprint .= (string) file_get_contents($path);
            }
        }

        return substr(hash('sha256', serialize($this->configuration->all()) . $deploymentFingerprint), 0, 20);
    }
}
