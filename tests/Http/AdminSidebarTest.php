<?php

declare(strict_types=1);

namespace Flex\Tests\Http;

use Flex\Http\View\TwigViewRenderer;
use Flex\Http\View\ViteAssetManager;
use PHPUnit\Framework\TestCase;

final class AdminSidebarTest extends TestCase
{
    public function testAdminShellUsesOneReactRootAndManifestAssets(): void
    {
        $basePath = dirname(__DIR__, 2);
        $views = new TwigViewRenderer($basePath);
        $assets = new ViteAssetManager($basePath);
        $html = $views->render('admin/app.twig', [
            'title' => 'Обновявания',
            'vite_tags' => $assets->tags(),
            'bootstrap_json' => '{"page":"updates"}',
        ]);

        self::assertStringContainsString('id="flex-admin-root"', $html);
        self::assertSame(1, substr_count($html, 'id="flex-admin-root"'));
        self::assertStringContainsString('id="flex-admin-bootstrap"', $html);
        self::assertMatchesRegularExpression('#/build/admin/assets/admin-[A-Za-z0-9_-]+\\.js#', $html);
        self::assertStringNotContainsString('/assets/admin.js', $html);
    }
}
