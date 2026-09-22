<?php

declare(strict_types=1);

namespace Flex\Tests\Container;

use Flex\Providers\AdminRouteServiceProvider;
use Flex\Providers\AuthRouteServiceProvider;
use Flex\Providers\CoreRouteServiceProvider;
use Flex\Providers\CoreServiceProvider;
use Flex\Providers\UpdateServiceProvider;
use Flex\Providers\UserRouteServiceProvider;
use Flex\Updates\Platform\PlatformVersionRegistry;
use PHPUnit\Framework\TestCase;

final class ProviderBoundariesTest extends TestCase
{
    public function testRouteProvidersDoNotOwnContainerBindings(): void
    {
        foreach ([new CoreRouteServiceProvider(), new AuthRouteServiceProvider(), new AdminRouteServiceProvider(), new UserRouteServiceProvider()] as $provider) {
            self::assertSame([], $provider->definitions());
        }
    }

    public function testUpdateBindingsAreNotRegisteredByCore(): void
    {
        self::assertArrayNotHasKey(PlatformVersionRegistry::class, (new CoreServiceProvider())->definitions());
        self::assertArrayHasKey(PlatformVersionRegistry::class, (new UpdateServiceProvider())->definitions());
    }
}
