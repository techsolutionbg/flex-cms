<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Themes\ThemeManager;
use Flex\Themes\ThemeRenderPaths;
use PHPUnit\Framework\TestCase;

final class ThemeRenderPathsTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-theme-render-' . bin2hex(random_bytes(4));
        mkdir($this->directory . '/themes/demo', 0777, true);
    }

    protected function tearDown(): void
    {
        $this->deleteDirectory($this->directory);
    }

    public function testResolvesLegacyViewIndexUnderSrcPages(): void
    {
        $root = $this->directory . '/themes/demo';
        mkdir($root . '/src/pages/page', 0777, true);
        file_put_contents($root . '/src/pages/page/index.php', '<?php echo "src-page";');
        self::assertSame(
            $root . '/src/pages/page/index.php',
            ThemeRenderPaths::resolvePhpTemplate($root, 'page'),
        );
    }

    public function testLegacyRootViewIndexBeforeSrc(): void
    {
        $root = $this->directory . '/themes/demo';
        mkdir($root . '/pages/page', 0777, true);
        mkdir($root . '/src/pages/page', 0777, true);
        file_put_contents($root . '/pages/page/index.php', '<?php echo "legacy";');
        file_put_contents($root . '/src/pages/page/index.php', '<?php echo "src";');
        self::assertSame($root . '/pages/page/index.php', ThemeRenderPaths::resolvePhpTemplate($root, 'page'));
    }

    public function testPrefersViewIndexOverViewPagePhp(): void
    {
        $root = $this->directory . '/themes/demo';
        mkdir($root . '/pages/page', 0777, true);
        file_put_contents($root . '/pages/page/index.php', '<?php echo "index";');
        file_put_contents($root . '/pages/page/page.php', '<?php echo "page";');
        self::assertSame($root . '/pages/page/index.php', ThemeRenderPaths::resolvePhpTemplate($root, 'page'));
    }

    public function testThemeIndexIgnoresLegacyViewFiles(): void
    {
        $root = $this->directory . '/themes/demo';
        mkdir($root . '/pages/page', 0777, true);
        file_put_contents($root . '/src/index.php', '<?php echo "unified";');
        file_put_contents($root . '/pages/page/index.php', '<?php echo "legacy";');
        self::assertSame($root . '/src/index.php', ThemeRenderPaths::resolvePhpTemplate($root, 'page'));
    }

    public function testThemeHasRenderEntryAcceptsSrcPagesDirectory(): void
    {
        $root = $this->directory . '/themes/demo';
        mkdir($root . '/src/pages/404', 0777, true);
        file_put_contents($root . '/src/pages/404/page.php', '<?php');
        self::assertTrue(ThemeManager::themeHasRenderEntry($root));
    }

    public function testUnifiedSrcIndexServesPageAnd404Views(): void
    {
        $root = $this->directory . '/themes/demo';
        file_put_contents($root . '/src/index.php', '<?php echo "view=" . ($theme_view ?? "");');
        self::assertSame($root . '/src/index.php', ThemeRenderPaths::resolvePhpTemplate($root, 'page'));
        self::assertSame($root . '/src/index.php', ThemeRenderPaths::resolvePhpTemplate($root, '404'));
    }

    public function testKriskataCorporateThemeMatchesFlexStarterEntryLayout(): void
    {
        $root = dirname(__DIR__, 2) . '/themes/kriskata-corporate';
        if (!is_file($root . '/pages/page.php')) {
            self::markTestSkipped('Reference theme not present.');
        }
        self::assertSame($root . '/pages/page.php', ThemeRenderPaths::resolveThemeEntryPath($root, 'page'));
        self::assertSame($root . '/pages/404.php', ThemeRenderPaths::resolveThemeEntryPath($root, '404'));
        self::assertTrue(ThemeManager::themeHasRenderEntry($root));
    }

    private function deleteDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $item) {
            $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
        }
        @rmdir($path);
    }
}
