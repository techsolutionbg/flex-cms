<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Extensions\Exception\InvalidPluginManifest;
use Flex\Extensions\PluginManifest;
use PHPUnit\Framework\TestCase;

final class PluginManifestTest extends TestCase
{
    public function testItParsesAndNormalizesAValidManifest(): void
    {
        $manifest = PluginManifest::fromArray([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.2.3',
            'entrypoint' => 'Acme\\Forms\\Plugin',
            'description' => ' Contact forms ',
            'minimum_platform_version' => '0.1.0',
            'autoload' => ['Acme\\Forms\\' => 'src'],
            'permissions' => ['admin.menu', 'admin.menu'],
            'dependencies' => ['acme/core' => '^1.0'],
        ]);

        self::assertSame('acme/forms', $manifest->id);
        self::assertSame('Forms', $manifest->name);
        self::assertSame('Contact forms', $manifest->description);
        self::assertSame(['admin.menu'], $manifest->permissions);
        self::assertSame(['Acme\\Forms\\' => 'src'], $manifest->autoload);
    }

    public function testItRejectsAnInvalidIdentifier(): void
    {
        $this->expectException(InvalidPluginManifest::class);
        $this->expectExceptionMessage('vendor/name format');

        PluginManifest::fromArray([
            'id' => 'invalid plugin',
            'name' => 'Forms',
            'version' => '1.0.0',
            'entrypoint' => 'Acme\\Forms\\Plugin',
        ]);
    }

    public function testItRejectsUnsafeAutoloadPaths(): void
    {
        $this->expectException(InvalidPluginManifest::class);
        $this->expectExceptionMessage('unsafe path');

        PluginManifest::fromArray([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.0.0',
            'entrypoint' => 'Acme\\Forms\\Plugin',
            'autoload' => ['Acme\\Forms\\' => '../src'],
        ]);
    }
}
