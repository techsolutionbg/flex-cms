<?php

declare(strict_types=1);

namespace Flex\Tests\Container;

use Flex\Configuration\ConfigurationRepository;
use Flex\Container\ContainerFactory;
use Flex\Contracts\Container\ServiceProviderInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

final class ContainerFactoryTest extends TestCase
{
    public function testItRegistersAndBootsConfiguredProviders(): void
    {
        TestServiceProvider::$booted = false;
        $configuration = new ConfigurationRepository([
            'container' => [
                'compile' => false,
                'providers' => [TestServiceProvider::class],
            ],
        ]);

        $container = (new ContainerFactory(sys_get_temp_dir(), $configuration))->build();

        self::assertSame('registered', $container->get('test.service'));
        self::assertTrue(TestServiceProvider::$booted);
    }

    public function testCompiledContainersAreIsolatedByResolvedConfiguration(): void
    {
        $basePath = sys_get_temp_dir() . '/flex-container-' . bin2hex(random_bytes(6));
        mkdir($basePath . '/storage/cache', 0775, true);

        try {
            $first = $this->compiledConfiguration('first');
            $second = $this->compiledConfiguration('second');

            self::assertSame('first', (new ContainerFactory($basePath, $first))->build()->get('test.value'));
            self::assertSame('second', (new ContainerFactory($basePath, $second))->build()->get('test.value'));

            $directories = glob($basePath . '/storage/cache/container/*', GLOB_ONLYDIR);
            self::assertIsArray($directories);
            self::assertCount(2, $directories);
        } finally {
            $this->removeDirectory($basePath);
        }
    }

    private function compiledConfiguration(string $value): ConfigurationRepository
    {
        return new ConfigurationRepository([
            'container' => [
                'compile' => true,
                'providers' => [$value === 'first' ? FirstCompiledProvider::class : SecondCompiledProvider::class],
            ],
            'test_fingerprint' => $value,
        ]);
    }

    private function removeDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }
        foreach (scandir($directory) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $path = $directory . '/' . $entry;
            is_dir($path) ? $this->removeDirectory($path) : @unlink($path);
        }
        @rmdir($directory);
    }
}

final class FirstCompiledProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return ['test.value' => 'first'];
    }

    public function boot(ContainerInterface $container): void {}
}

final class SecondCompiledProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return ['test.value' => 'second'];
    }

    public function boot(ContainerInterface $container): void {}
}

final class TestServiceProvider implements ServiceProviderInterface
{
    public static bool $booted = false;

    public function definitions(): array
    {
        return ['test.service' => 'registered'];
    }

    public function boot(ContainerInterface $container): void
    {
        self::$booted = $container->has('test.service');
    }
}
