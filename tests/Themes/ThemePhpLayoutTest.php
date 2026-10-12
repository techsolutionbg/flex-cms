<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Themes\ThemeManager;
use PHPUnit\Framework\TestCase;

final class ThemePhpLayoutTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-theme-layout-' . bin2hex(random_bytes(4));
        mkdir($this->directory . '/themes/demo', 0777, true);
    }

    protected function tearDown(): void
    {
        $this->deleteDirectory($this->directory);
    }

    public function testResolvesPageTemplateFromPagesDirectory(): void
    {
        mkdir($this->directory . '/themes/demo/pages', 0777, true);
        file_put_contents($this->directory . '/themes/demo/theme.json', '{"id":"demo","name":"Demo","version":"1.0.0","author":"Test","description":"Test"}');
        file_put_contents($this->directory . '/themes/demo/pages/page.php', '<?php echo "pages-page";');
        $manager = $this->manager('demo');
        self::assertSame('pages-page', $manager->renderForTheme('demo', 'page.twig'));
    }

    public function testResolvesNamedPageTemplate(): void
    {
        mkdir($this->directory . '/themes/demo/pages', 0777, true);
        file_put_contents($this->directory . '/themes/demo/theme.json', '{"id":"demo","name":"Demo","version":"1.0.0","author":"Test","description":"Test"}');
        file_put_contents($this->directory . '/themes/demo/pages/404.php', '<?php echo "not-found";');
        $manager = $this->manager('demo');
        self::assertSame('not-found', $manager->renderForTheme('demo', '404.twig'));
    }

    public function testThemeHasRenderEntryAcceptsPagesDirectory(): void
    {
        $root = $this->directory . '/themes/demo';
        mkdir($root . '/pages', 0777, true);
        file_put_contents($root . '/pages/page.php', '<?php');
        self::assertTrue(ThemeManager::themeHasRenderEntry($root));
    }

    private function manager(string $active): ThemeManager
    {
        $config = new ConfigurationRepository([
            'paths' => ['themes' => 'themes'],
            'app' => ['active_theme' => $active],
        ]);

        return new ThemeManager(new ProjectPaths($this->directory, $config), $config);
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
