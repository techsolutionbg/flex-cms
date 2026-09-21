<?php

declare(strict_types=1);

namespace Flex\Tests\Container;

use Flex\Application;
use Flex\Bootstrap;
use Flex\Console\FlexConsoleApplication;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class BootstrapTest extends TestCase
{
    public function testItBuildsTheProjectContainer(): void
    {
        $bootstrap = Bootstrap::boot(dirname(__DIR__, 2));
        $container = $bootstrap->container();

        self::assertSame('Flex CMS', $bootstrap->configuration()->string('app.name'));
        self::assertInstanceOf(ConfigRepositoryInterface::class, $container->get(ConfigRepositoryInterface::class));
        self::assertInstanceOf(Application::class, $container->get(Application::class));
        self::assertInstanceOf(FlexConsoleApplication::class, $container->get(FlexConsoleApplication::class));
        self::assertInstanceOf(LoggerInterface::class, $container->get(LoggerInterface::class));
    }
}
