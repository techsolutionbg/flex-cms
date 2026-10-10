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
}
