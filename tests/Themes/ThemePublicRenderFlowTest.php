<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Themes\ThemeManager;
use Flex\Themes\ThemeRenderPaths;
use PHPUnit\Framework\TestCase;

/** Documents the public theme render path: twig name → theme_view → index.php include. */
final class ThemePublicRenderFlowTest extends TestCase
{
    public function testLogicalViewFromTemplateMatchesThemeView(): void
    {
        self::assertSame('page', ThemeRenderPaths::logicalViewFromTemplate('page.twig'));
        self::assertSame('404', ThemeRenderPaths::logicalViewFromTemplate('404.twig'));
    }

    public function testKriskataUsesFlexStarterStylePageEntries(): void
    {
        $root = dirname(__DIR__, 2) . '/themes/kriskata-corporate';
        if (!is_file($root . '/pages/page.php')) {
            self::markTestSkipped('Reference theme not present.');
        }
        self::assertSame($root . '/pages/page.php', ThemeRenderPaths::resolveThemeEntryPath($root, ThemeRenderPaths::VIEW_PAGE));
        self::assertSame($root . '/pages/404.php', ThemeRenderPaths::resolveThemeEntryPath($root, ThemeRenderPaths::VIEW_NOT_FOUND));
    }

    public function testThemeManagerIncludePassesThemeViewToIndex(): void
    {
        $directory = sys_get_temp_dir() . '/flex-flow-' . bin2hex(random_bytes(4));
        mkdir($directory . '/themes/demo/src', 0777, true);
        file_put_contents($directory . '/themes/demo/theme.json', '{"id":"demo","name":"Demo","version":"1.0.0","author":"Test","description":"Test"}');
        file_put_contents(
            $directory . '/themes/demo/src/index.php',
            '<?php echo "entry=" . ($theme_view ?? "") . ";error=" . (($isErrorPage ?? false) ? "1" : "0");',
        );
        try {
            $config = new ConfigurationRepository([
                'paths' => ['themes' => 'themes'],
                'app' => ['active_theme' => 'demo'],
            ]);
            $manager = new ThemeManager(new ProjectPaths($directory, $config), $config);
            self::assertSame('entry=page;error=0', $manager->renderForTheme('demo', 'page.twig'));
            self::assertSame('entry=404;error=1', $manager->renderForTheme('demo', '404.twig', ['title' => 'X']));
        } finally {
            $this->deleteDirectory($directory);
        }
    }

    public function testThemeValidWhenOnlyLegacy404EntryExists(): void
    {
        $directory = sys_get_temp_dir() . '/flex-flow-404-' . bin2hex(random_bytes(4));
        mkdir($directory . '/themes/demo/pages/404', 0777, true);
        file_put_contents($directory . '/themes/demo/pages/404/index.php', '<?php');
        try {
            self::assertTrue(ThemeManager::themeHasRenderEntry($directory . '/themes/demo'));
        } finally {
            $this->deleteDirectory($directory);
        }
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
