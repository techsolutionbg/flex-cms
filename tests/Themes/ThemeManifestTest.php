<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Themes\Exception\InvalidThemeManifest;
use Flex\Themes\ThemeManifest;
use PHPUnit\Framework\TestCase;

final class ThemeManifestTest extends TestCase
{
    public function testItValidatesThemeMetadata(): void
    {
        $manifest = ThemeManifest::fromArray(['id' => 'flex-default', 'name' => 'Flex Default', 'version' => '1.2.0', 'author' => 'Flex CMS']);

        self::assertSame('flex-default', $manifest->id);
        self::assertSame('1.2.0', $manifest->version);
        self::assertSame('Flex CMS', $manifest->author);
    }

    public function testItRejectsNonSemanticVersions(): void
    {
        $this->expectException(InvalidThemeManifest::class);
        ThemeManifest::fromArray(['id' => 'flex-default', 'name' => 'Flex Default', 'version' => 'latest']);
    }

    public function testItPreservesMenuCapabilitiesAndLocations(): void
    {
        $data = ['id' => 'demo', 'name' => 'Demo', 'version' => '1.0.0', 'supports' => ['menus' => true], 'menu_locations' => ['primary' => 'Главно меню', 'footer' => 'Футър']];
        $manifest = ThemeManifest::fromArray($data);
        self::assertTrue($manifest->supports['menus']);
        self::assertSame($data, $manifest->toArray());
        self::assertSame([], ThemeManifest::fromArray(['id' => 'old', 'name' => 'Old', 'version' => '1.0.0'])->supports);
        self::assertTrue(ThemeManifest::fromArray([...$data, 'supports' => ['menus']])->supports['menus']);
    }

    public function testItRejectsStringsThatLookLikeBooleanSupport(): void
    {
        $this->expectException(InvalidThemeManifest::class);
        ThemeManifest::fromArray(['id' => 'demo', 'name' => 'Demo', 'version' => '1.0.0', 'supports' => ['menus' => 'false']]);
    }

    public function testItRejectsInvalidMenuLocationIdentifiers(): void
    {
        $this->expectException(InvalidThemeManifest::class);
        ThemeManifest::fromArray(['id' => 'demo', 'name' => 'Demo', 'version' => '1.0.0', 'menu_locations' => ['../invalid' => 'Invalid']]);
    }
}
