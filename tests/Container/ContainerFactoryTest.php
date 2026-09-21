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
