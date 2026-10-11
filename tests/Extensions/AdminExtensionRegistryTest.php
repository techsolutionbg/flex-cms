<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Extensions\AdminExtensionRegistry;
use Flex\Extensions\Exception\PluginPermissionDenied;
use PHPUnit\Framework\TestCase;

final class AdminExtensionRegistryTest extends TestCase
{
    public function testAdminUiRequiresExplicitPermission(): void
    {
        $registry = new AdminExtensionRegistry();

        $this->expectException(PluginPermissionDenied::class);
        $registry->registrar('acme/forms', [])->sidebarItem('forms', 'Форми', '/admin/plugins/acme/forms');
    }

    public function testApprovedPluginRegistersSafeSidebarAndSlotDescriptors(): void
    {
        $registry = new AdminExtensionRegistry();
        $registrar = $registry->registrar('acme/forms', ['admin.ui']);
        $registrar->sidebarItem('forms', 'Форми', '/admin/plugins/acme/forms');
        $registrar->slot('admin.dashboard.after', 'card', 'Форми', 'Управление на формите.');

        self::assertSame([
            ['id' => 'forms', 'label' => 'Форми', 'href' => '/admin/plugins/acme/forms'],
        ], $registry->bootstrap()['sidebar']);
        self::assertSame('card', $registry->bootstrap()['slots']['admin.dashboard.after'][0]['kind']);
    }

    public function testUnknownOrUnsafeSlotsAreRejected(): void
    {
        $registrar = (new AdminExtensionRegistry())->registrar('acme/forms', ['admin.ui']);

        $this->expectException(\InvalidArgumentException::class);
        $registrar->slot('admin.editor.before', 'card', 'Unsafe');
    }

    public function testReactPagesAreNamespacedAndRequireSafeModulePaths(): void
    {
        $registry = new AdminExtensionRegistry();
        $registrar = $registry->registrar('acme/forms', ['admin.ui']);
        $registrar->page('forms', 'Форми', 'assets/admin.js', true);
        $page = $registry->bootstrap()['pages'][0];
        self::assertSame('/extension-pages/acme-forms-forms', $page['href']);
        self::assertSame('/extensions/acme/forms/assets/assets/admin.js', $page['module']);
        self::assertTrue($page['embeddable']);
        self::assertSame(['group' => 'extensions', 'icon' => 'puzzle'], $page['navigation']);
        $this->expectException(\InvalidArgumentException::class);
        $registrar->page('other', 'Unsafe', '../admin.js');
    }

    public function testPagesDeclareNavigationWithoutPluginSpecificCoreRules(): void
    {
        $registry = new AdminExtensionRegistry();
        $registrar = $registry->registrar('acme/photos', ['admin.ui']);
        $registrar->page('photos', 'Снимки', 'admin.js', false, ['group' => 'content', 'icon' => 'images']);
        self::assertSame(['group' => 'content', 'icon' => 'images'], $registry->bootstrap()['pages'][0]['navigation']);
        $this->expectException(\InvalidArgumentException::class);
        $registrar->page('invalid', 'Невалидно', 'admin.js', false, ['group' => 'unknown']);
    }

    public function testHiddenPagesAreLeftOutOfTheSidebar(): void
    {
        $registry = new AdminExtensionRegistry();
        $registrar = $registry->registrar('acme/editor', ['admin.ui']);
        $registrar->page('page', 'Редактор', 'admin.js', false, ['group' => 'content', 'hidden' => true]);
        $registrar->page('list', 'Списък', 'admin.js');
        $bootstrap = $registry->bootstrap();
        self::assertSame(['group' => 'content', 'icon' => 'puzzle', 'hidden' => true], $bootstrap['pages'][0]['navigation']);
        self::assertSame('/extension-pages/acme-editor-page', $bootstrap['pages'][0]['href']);
        self::assertSame(['/extension-pages/acme-editor-list'], array_column($bootstrap['sidebar'], 'href'));
        $this->expectException(\InvalidArgumentException::class);
        $registrar->page('other', 'Друго', 'admin.js', false, ['hidden' => 'yes']);
    }

    public function testPagesCanDeclareAShopSectionAndOrder(): void
    {
        $registry = new AdminExtensionRegistry();
        $registrar = $registry->registrar('flex/commerce', ['admin.ui']);
        $registrar->page('products', 'Продукти', 'admin.js', false, ['group' => 'commerce', 'icon' => 'shopping-bag', 'section' => 'catalog', 'order' => 1]);
        self::assertSame(
            ['group' => 'commerce', 'icon' => 'shopping-bag', 'section' => 'catalog', 'order' => 1],
            $registry->bootstrap()['pages'][0]['navigation'],
        );
        $this->expectException(\InvalidArgumentException::class);
        $registrar->page('other', 'Друго', 'admin.js', false, ['group' => 'commerce', 'section' => 'warehouse']);
    }
    public function testModuleUrlChangesWhenItsContentsChange(): void
    {
        $directory = sys_get_temp_dir() . '/flex-admin-assets-' . bin2hex(random_bytes(8));
        mkdir($directory);
        try {
            file_put_contents($directory . '/admin.js', 'export const version = 1;');
            $registry = new AdminExtensionRegistry();
            $registrar = $registry->registrar('acme/forms', ['admin.ui'], $directory);
            $registrar->page('forms', 'Forms', 'admin.js');
            $first = $registry->bootstrap()['pages'][0]['module'];
            self::assertStringContainsString('?v=', $first);
            $registrar->page('forms', 'Forms', 'admin.js');
            self::assertSame($first, $registry->bootstrap()['pages'][0]['module']);
            file_put_contents($directory . '/admin.js', 'export const version = 2;');
            $registrar->page('forms', 'Forms', 'admin.js');
            self::assertNotSame($first, $registry->bootstrap()['pages'][0]['module']);
        } finally {
            unlink($directory . '/admin.js');
            rmdir($directory);
        }
    }

    public function testPanelsAreValidatedNamespacedAndOrdered(): void
    {
        $registry = new AdminExtensionRegistry();
        $registrar = $registry->registrar('acme/seo', ['admin.ui']);
        $registrar->panel('page.editor', 'meta', 'SEO', 'assets/panels.js', ['order' => 20, 'icon' => 'file-text']);
        $registrar->panel('pages.list.column', 'score', 'SEO', 'assets/panels.js');
        $registry->registrar('acme/forms', ['admin.ui'])->panel('page.editor', 'forms', 'Forms', 'panel.js', ['order' => 10, 'default_open' => false]);

        $panels = $registry->bootstrap()['panels'];
        self::assertSame(['acme-forms-forms', 'acme-seo-meta', 'acme-seo-score'], array_column($panels, 'id'));
        self::assertSame([
            'id' => 'acme-seo-meta',
            'plugin' => 'acme/seo',
            'location' => 'page.editor',
            'label' => 'SEO',
            'module' => '/extensions/acme/seo/assets/assets/panels.js',
            'export' => 'createPanel',
            'icon' => 'file-text',
            'default_open' => true,
            'order' => 20,
        ], $panels[1]);
        self::assertSame('createColumn', $panels[2]['export'], 'Columns use createColumn by default.');
        self::assertFalse($panels[0]['default_open']);
    }

    public function testPanelsRequirePermissionAndKnownLocations(): void
    {
        $registry = new AdminExtensionRegistry();
        foreach ([
            ['unknown.place', 'meta', 'SEO', 'panels.js', []],
            ['page.editor', 'Bad Id', 'SEO', 'panels.js', []],
            ['page.editor', 'meta', ' ', 'panels.js', []],
            ['page.editor', 'meta', 'SEO', '../panels.js', []],
            ['page.editor', 'meta', 'SEO', 'panels.js', ['order' => -1]],
            ['page.editor', 'meta', 'SEO', 'panels.js', ['export' => 'bad-name']],
            ['page.editor', 'meta', 'SEO', 'panels.js', ['icon' => 'rocket']],
        ] as [$location, $id, $label, $module, $options]) {
            try {
                $registry->registrar('acme/seo', ['admin.ui'])->panel($location, $id, $label, $module, $options);
                self::fail('Expected an invalid panel to be rejected: ' . json_encode([$location, $id, $module, $options]));
            } catch (\InvalidArgumentException) {
                self::assertSame([], $registry->bootstrap()['panels']);
            }
        }
        $this->expectException(PluginPermissionDenied::class);
        $registry->registrar('acme/seo', [])->panel('page.editor', 'meta', 'SEO', 'panels.js');
    }

    public function testExtensionsTargetNamedPointsAndSlots(): void
    {
        $registry = new AdminExtensionRegistry();
        $registrar = $registry->registrar('acme/seo', ['admin.ui']);
        $registrar->extend('page.editor.publishing', 'section.end', 'score', 'assets/panels.js', ['order' => 5]);
        $registrar->extend('users.list', 'table.row-action', 'reset', 'assets/panels.js');
        $registrar->extend('commerce.product.editor.pricing', 'section.nested', 'vat', 'assets/panels.js', ['label' => 'ДДС', 'icon' => 'sliders', 'default_open' => false]);
        $registrar->extend('media.list', 'table.toolbar', 'type', 'assets/panels.js', ['export' => 'mediaFilter']);

        $extensions = $registry->bootstrap()['extensions'];
        self::assertSame(['acme-seo-score', 'acme-seo-reset', 'acme-seo-type', 'acme-seo-vat'], array_column($extensions, 'id'));
        self::assertSame([
            'id' => 'acme-seo-score',
            'plugin' => 'acme/seo',
            'point' => 'page.editor.publishing',
            'slot' => 'section.end',
            'label' => '',
            'module' => '/extensions/acme/seo/assets/assets/panels.js',
            'export' => 'createPanel',
            'icon' => 'puzzle',
            'default_open' => true,
            'order' => 5,
        ], $extensions[0]);
        self::assertSame('createRowAction', $extensions[1]['export'], 'Each slot has its default export.');
        self::assertSame('mediaFilter', $extensions[2]['export']);
        self::assertSame(['ДДС', 'sliders', false], [$extensions[3]['label'], $extensions[3]['icon'], $extensions[3]['default_open']]);
    }

    public function testPanelsAreShorthandForExtensions(): void
    {
        $registry = new AdminExtensionRegistry();
        $registrar = $registry->registrar('acme/seo', ['admin.ui']);
        $registrar->panel('page.editor', 'meta', 'SEO', 'assets/panels.js');
        $registrar->panel('pages.list.column', 'score', 'SEO', 'assets/panels.js');
        $registrar->panel('settings.tab', 'settings', 'SEO', 'assets/panels.js');
        $registrar->panel('commerce.product.editor', 'product', 'SEO', 'assets/panels.js');

        $bootstrap = $registry->bootstrap();
        self::assertCount(4, $bootstrap['panels'], 'The panels list is kept for existing clients.');
        $targets = array_map(static fn(array $extension): string => $extension['point'] . ' ' . $extension['slot'] . ' ' . $extension['export'], $bootstrap['extensions']);
        sort($targets);
        self::assertSame([
            'commerce.product.editor screen.section createPanel',
            'page.editor screen.section createPanel',
            'pages.list table.column createColumn',
            'settings screen.tab createPanel',
        ], $targets);
    }

    public function testInvalidExtensionsAreRejected(): void
    {
        $registry = new AdminExtensionRegistry();
        foreach ([
            ['Page.Editor', 'section.end', 'x', 'p.js', []],
            ['page..editor', 'section.end', 'x', 'p.js', []],
            ['page.editor', 'section.middle', 'x', 'p.js', []],
            ['page.editor', 'section.end', 'Bad', 'p.js', []],
            ['page.editor', 'section.end', 'x', '../p.js', []],
            ['page.editor', 'screen.section', 'x', 'p.js', []],
            ['page.editor', 'section.end', 'x', 'p.js', ['icon' => 'rocket']],
            ['page.editor', 'section.end', 'x', 'p.js', ['export' => 'bad-name']],
            ['page.editor', 'section.end', 'x', 'p.js', ['order' => -1]],
        ] as [$point, $slot, $id, $module, $options]) {
            try {
                $registry->registrar('acme/seo', ['admin.ui'])->extend($point, $slot, $id, $module, $options);
                self::fail('Expected an invalid extension to be rejected: ' . json_encode([$point, $slot, $id, $module, $options]));
            } catch (\InvalidArgumentException) {
                self::assertSame([], $registry->bootstrap()['extensions']);
            }
        }
        $this->expectException(PluginPermissionDenied::class);
        $registry->registrar('acme/seo', [])->extend('page.editor', 'section.end', 'x', 'p.js');
    }
}
