<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Extensions\ExtensionApi;
use Flex\Extensions\ScopedExtensionApi;
use Flex\Extensions\Exception\PluginPermissionDenied;
use PHPUnit\Framework\TestCase;

final class ScopedExtensionApiTest extends TestCase
{
    public function testEventListenersRequireExplicitPermission(): void
    {
        $api = new ScopedExtensionApi(new ExtensionApi(), 'acme/forms', []);

        $this->expectException(PluginPermissionDenied::class);
        $api->listen('page.created', static function (): void {});
    }

    public function testEventListenersCanBeRegisteredWhenApproved(): void
    {
        $api = new ScopedExtensionApi(new ExtensionApi(), 'acme/forms', ['events.listen']);
        $called = false;
        $api->listen('page.created', static function () use (&$called): void { $called = true; });

        $api->dispatch(new class implements \Flex\Extension\V1\ExtensionEventInterface {
            public function name(): string { return 'page.created'; }
            public function payload(): array { return []; }
        });

        self::assertTrue($called);
    }
}
