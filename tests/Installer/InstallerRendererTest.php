<?php

declare(strict_types=1);

namespace Flex\Tests\Installer;

use Flex\Installer\Http\InstallerRenderer;
use PHPUnit\Framework\TestCase;

final class InstallerRendererTest extends TestCase
{
    private string $basePath;

    protected function setUp(): void
    {
        $this->basePath = sys_get_temp_dir() . '/flex-installer-renderer-' . bin2hex(random_bytes(6));
        mkdir($this->basePath . '/public/build/installer/.vite', 0770, true);
        file_put_contents($this->basePath . '/public/build/installer/.vite/manifest.json', json_encode([
            'installer.html' => ['file' => 'assets/installer-hash.js', 'css' => ['assets/installer-hash.css']],
        ], JSON_THROW_ON_ERROR));
    }

    protected function tearDown(): void
    {
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->basePath, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($this->basePath);
    }

    public function testItRendersTheCompiledReactInstallerShell(): void
    {
        $html = (new InstallerRenderer($this->basePath))->reactApplication('csrf-token');

        self::assertStringContainsString('id="root"', $html);
        self::assertStringContainsString('/build/installer/assets/installer-hash.css', $html);
        self::assertStringContainsString('/build/installer/assets/installer-hash.js', $html);
        self::assertStringNotContainsString('name="database_name"', $html);
    }
}
