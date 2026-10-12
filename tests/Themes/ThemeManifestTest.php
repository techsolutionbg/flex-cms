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

    public function testItReadsPageTemplatesFromTheTheme(): void
    {
        $manifest = ThemeManifest::fromArray([
            'id' => 'demo',
            'name' => 'Demo',
            'version' => '1.0.0',
            'templates' => [['id' => 'default', 'label' => 'По подразбиране']],
        ]);

        self::assertSame([['id' => 'default', 'label' => 'По подразбиране']], $manifest->templates);
        self::assertSame([], ThemeManifest::fromArray(['id' => 'old', 'name' => 'Old', 'version' => '1.0.0'])->templates);
    }

    public function testItRejectsDuplicatePageTemplates(): void
    {
        $this->expectException(InvalidThemeManifest::class);
        ThemeManifest::fromArray([
            'id' => 'demo',
            'name' => 'Demo',
            'version' => '1.0.0',
            'templates' => [
                ['id' => 'default', 'label' => 'По подразбиране'],
                ['id' => 'default', 'label' => 'Още веднъж'],
            ],
        ]);
    }

    public function testItPlacesThemeNavigationOnThreeLevels(): void
    {
        $manifest = ThemeManifest::fromArray([
            'id' => 'demo',
            'name' => 'Demo',
            'version' => '1.0.0',
            'admin_navigation' => [
                ['id' => 'studio', 'label' => 'Студио', 'icon' => 'palette', 'children' => [
                    ['id' => 'services', 'label' => 'Услуги', 'page' => 'services'],
                    ['id' => 'portfolio', 'label' => 'Портфолио', 'children' => [
                        ['id' => 'websites', 'label' => 'Сайтове', 'page' => 'projects'],
                    ]],
                ]],
                ['id' => 'projects', 'label' => 'Проекти', 'icon' => 'folder', 'group' => 'content', 'order' => 30, 'page' => 'projects'],
                ['id' => 'offers', 'label' => 'Оферти', 'group' => 'commerce', 'section' => 'catalog', 'href' => '/pages'],
            ],
        ]);

        $placed = $manifest->placedNavigation();
        self::assertSame('studio', $placed['groups'][0]['id']);
        self::assertSame('portfolio', $placed['sections'][0]['id']);
        self::assertSame(['services', 'websites', 'projects', 'offers'], array_column($placed['items'], 'id'));
        self::assertSame('content', $placed['items'][2]['group']);
        self::assertSame('portfolio', $placed['items'][1]['section']);
        self::assertSame('catalog', $placed['items'][3]['section']);
    }

    public function testItRejectsNavigationDeeperThanThreeLevels(): void
    {
        $this->expectException(InvalidThemeManifest::class);
        ThemeManifest::fromArray([
            'id' => 'demo',
            'name' => 'Demo',
            'version' => '1.0.0',
            'admin_navigation' => [
                ['id' => 'studio', 'label' => 'Студио', 'children' => [
                    ['id' => 'portfolio', 'label' => 'Портфолио', 'children' => [
                        ['id' => 'websites', 'label' => 'Сайтове', 'children' => [
                            ['id' => 'archive', 'label' => 'Архив', 'href' => '/pages'],
                        ]],
                    ]],
                ]],
            ],
        ]);
    }

    public function testItDeclaresCollectionsWithPageScreens(): void
    {
        $manifest = ThemeManifest::fromArray([
            'id' => 'demo',
            'name' => 'Demo',
            'version' => '1.0.0',
            'resources' => [[
                'id' => 'projects',
                'label' => 'Проекти',
                'singular' => 'Проект',
                'icon' => 'folder',
                'group' => 'content',
                'order' => 30,
                'public_page' => 'projects',
            ]],
        ]);

        self::assertSame('projects', $manifest->resources[0]['id']);
        self::assertSame('Проект', $manifest->resources[0]['singular']);
        self::assertSame([], $manifest->placedNavigation()['items']);
    }

    public function testItRejectsDuplicateCollections(): void
    {
        $this->expectException(InvalidThemeManifest::class);
        ThemeManifest::fromArray([
            'id' => 'demo',
            'name' => 'Demo',
            'version' => '1.0.0',
            'resources' => [
                ['id' => 'projects', 'label' => 'Проекти'],
                ['id' => 'projects', 'label' => 'Още проекти'],
            ],
        ]);
    }

    public function testItRejectsInvalidMenuLocationIdentifiers(): void
    {
        $this->expectException(InvalidThemeManifest::class);
        ThemeManifest::fromArray(['id' => 'demo', 'name' => 'Demo', 'version' => '1.0.0', 'menu_locations' => ['../invalid' => 'Invalid']]);
    }
}
