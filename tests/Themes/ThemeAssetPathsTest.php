<?php

declare(strict_types=1);

namespace Flex\Tests\Themes;

use Flex\Themes\ThemeAssetPaths;
use PHPUnit\Framework\TestCase;

final class ThemeAssetPathsTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-theme-assets-' . bin2hex(random_bytes(4));
        mkdir($this->directory . '/src/assets', 0777, true);
        file_put_contents($this->directory . '/src/assets/style.css', 'body{}');
        file_put_contents($this->directory . '/src/assets/screenshot.svg', '<svg></svg>');
    }

    protected function tearDown(): void
    {
        $this->deleteDirectory($this->directory);
    }

    public function testResolvesStylesheetFromSrcAssets(): void
    {
        self::assertSame(
            realpath($this->directory . '/src/assets/style.css'),
            ThemeAssetPaths::resolveStylesheet($this->directory),
        );
    }

    public function testResolvesScreenshotFromSrcAssets(): void
    {
        $resolved = ThemeAssetPaths::resolveScreenshot($this->directory, 'screenshot.svg');
        self::assertNotNull($resolved);
        self::assertSame('screenshot.svg', $resolved['public_suffix']);
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
