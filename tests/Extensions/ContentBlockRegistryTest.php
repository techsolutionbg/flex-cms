<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Extensions\ContentBlockRegistry;
use Flex\Extensions\Exception\PluginPermissionDenied;
use PHPUnit\Framework\TestCase;

final class ContentBlockRegistryTest extends TestCase
{
    public function testContentBlockRegistrationRequiresExplicitPermission(): void
    {
        $registry = new ContentBlockRegistry();

        $this->expectException(PluginPermissionDenied::class);
        $registry->registrar('acme/forms', [])->register('form', static fn(array $data): array => $data);
    }

    public function testApprovedPluginCanRegisterContentBlock(): void
    {
        $registry = new ContentBlockRegistry();
        $normalizer = static fn(array $data): array => $data;

        $registry->registrar('acme/forms', ['content.blocks'])->register('form', $normalizer);

        self::assertSame($normalizer, $registry->normalizer('form'));
    }
}
