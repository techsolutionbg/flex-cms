<?php

declare(strict_types=1);

namespace Flex\Tests\Http;

use Flex\Http\Controller\Admin\AdminSidebar;
use Flex\Updates\Platform\PlatformVersionRegistry;
use PHPUnit\Framework\TestCase;

final class AdminSidebarTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-sidebar-' . bin2hex(random_bytes(6));
        mkdir($this->directory, 0775, true);
        file_put_contents($this->directory . '/platform.json', json_encode([
            'name' => 'flex-cms',
            'version' => '0.0.3',
            'api_version' => '1.0',
        ], JSON_THROW_ON_ERROR));
    }

    protected function tearDown(): void
    {
        @unlink($this->directory . '/platform.json');
        @rmdir($this->directory);
    }

    public function testItRendersTheSystemNameVersionAndActiveNavigationItem(): void
    {
        $html = (new AdminSidebar(new PlatformVersionRegistry($this->directory)))->render('updates');

        self::assertStringContainsString('Flex CMS', $html);
        self::assertStringContainsString('v0.0.3', $html);
        self::assertStringContainsString('bi bi-speedometer2', $html);
        self::assertStringContainsString('bi bi-arrow-repeat', $html);
        self::assertStringContainsString('sidebar-resizer', $html);
        self::assertStringContainsString('sidebar-toggle', $html);
        self::assertStringContainsString('sidebar-backdrop', $html);
        self::assertStringContainsString('data-sidebar-width="248"', $html);
        self::assertStringContainsString('role="separator"', $html);
        self::assertStringContainsString('aria-controls="admin-sidebar"', $html);
        self::assertStringContainsString('Промени широчината', $html);
        self::assertStringContainsString('href="/admin/updates" aria-current="page"', $html);
        self::assertStringNotContainsString('href="/admin" aria-current="page"', $html);
    }
}
