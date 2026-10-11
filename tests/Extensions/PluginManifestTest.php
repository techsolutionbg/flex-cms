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

    public function testItParsesFrontendAssets(): void
    {
        $manifest = PluginManifest::fromArray([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.0.0',
            'entrypoint' => 'Acme\\Forms\\Plugin',
            'frontend' => [
                'scripts' => ['assets/admin.js', 'assets/forms.js'],
                'styles' => ['assets/forms.css'],
                'public' => [
                    'scripts' => ['assets/forms.js'],
                    'styles' => ['assets/forms.css'],
                ],
            ],
        ]);

        self::assertSame(['assets/admin.js', 'assets/forms.js'], $manifest->frontend['scripts'] ?? []);
        self::assertSame(['assets/forms.css'], $manifest->frontend['styles'] ?? []);
        self::assertSame(['assets/forms.js'], $manifest->frontend['public']['scripts'] ?? []);
        self::assertSame(['assets/forms.css'], $manifest->frontend['public']['styles'] ?? []);
    }

    public function testItParsesPublicAssetGroupsAndAllowsTheirFiles(): void
    {
        $manifest = PluginManifest::fromArray([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.0.0',
            'entrypoint' => 'Acme\\Forms\\Plugin',
            'frontend' => [
                'public' => [
                    'scripts' => ['assets/badge.js'],
                    'groups' => ['form-page' => ['scripts' => ['assets/forms.js'], 'styles' => ['assets/forms.css']]],
                ],
            ],
        ]);

        self::assertSame(['assets/badge.js'], $manifest->frontend['public']['scripts']);
        self::assertSame(['scripts' => ['assets/forms.js'], 'styles' => ['assets/forms.css']], $manifest->frontend['public']['groups']['form-page']);
        self::assertSame(['assets/badge.js', 'assets/forms.js'], $manifest->frontend['scripts'], 'group files are served like the other public files');
        self::assertSame(['assets/forms.css'], $manifest->frontend['styles']);
        self::assertSame($manifest->frontend, PluginManifest::fromArray($manifest->toArray())->frontend);
    }

    /** @return iterable<string, array{mixed}> */
    public static function invalidGroups(): iterable
    {
        yield 'list' => [[['scripts' => ['assets/a.js']]]];
        yield 'bad name' => [['Forms' => ['scripts' => ['assets/a.js']]]];
        yield 'unsafe path' => [['forms' => ['scripts' => ['../a.js']]]];
        yield 'not a list of paths' => [['forms' => ['scripts' => 'assets/a.js']]];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('invalidGroups')]
    public function testItRejectsInvalidPublicAssetGroups(mixed $groups): void
    {
        $this->expectException(InvalidPluginManifest::class);

        PluginManifest::fromArray([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.0.0',
            'entrypoint' => 'Acme\\Forms\\Plugin',
            'frontend' => ['public' => ['groups' => $groups]],
        ]);
    }

    public function testItRejectsUnsafeFrontendAssets(): void
    {
        $this->expectException(InvalidPluginManifest::class);
        $this->expectExceptionMessage('unsafe asset path');

        PluginManifest::fromArray([
            'id' => 'acme/forms',
            'name' => 'Forms',
            'version' => '1.0.0',
            'entrypoint' => 'Acme\\Forms\\Plugin',
            'frontend' => ['scripts' => ['../secret.js']],
        ]);
    }
}
