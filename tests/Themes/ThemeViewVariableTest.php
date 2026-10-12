<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Themes\ThemeManager;
use PHPUnit\Framework\TestCase;

final class ThemeViewVariableTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-theme-view-' . bin2hex(random_bytes(4));
        mkdir($this->directory . '/themes/demo/src', 0777, true);
        file_put_contents($this->directory . '/themes/demo/theme.json', '{"id":"demo","name":"Demo","version":"1.0.0","author":"Test","description":"Test"}');
        file_put_contents(
            $this->directory . '/themes/demo/src/index.php',
            '<?php echo "view=" . (string) ($theme_view ?? "");',
        );
    }

    protected function tearDown(): void
    {
        $this->deleteDirectory($this->directory);
    }

    public function testThemeViewIsAvailableInPhpTemplate(): void
    {
        $config = new ConfigurationRepository([
            'paths' => ['themes' => 'themes'],
            'app' => ['active_theme' => 'demo'],
        ]);
        $manager = new ThemeManager(new ProjectPaths($this->directory, $config), $config);
        self::assertSame('view=page', $manager->renderForTheme('demo', 'page.twig'));
        self::assertSame('view=404', $manager->renderForTheme('demo', '404.twig'));
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
