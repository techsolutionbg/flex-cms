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
}
