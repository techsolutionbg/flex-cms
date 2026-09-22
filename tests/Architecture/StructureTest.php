<?php

declare(strict_types=1);

namespace Flex\Tests\Architecture;

use PHPUnit\Framework\TestCase;

final class StructureTest extends TestCase
{
    private const ROOT = __DIR__ . '/../..';

    public function testBackendTestsUseTheProjectNamespace(): void
    {
        foreach ($this->phpFiles(self::ROOT . '/tests') as $file) {
            if (str_ends_with($file, '/Support/ArraySession.php')) {
                continue;
            }

            $contents = (string) file_get_contents($file);
            self::assertStringContainsString('namespace Flex\\Tests', $contents, $file);
        }
    }

    public function testControllersDoNotRenderCompleteHtmlDocuments(): void
    {
        foreach ($this->phpFiles(self::ROOT . '/src/Http/Controller') as $file) {
            $contents = strtolower((string) file_get_contents($file));
            self::assertStringNotContainsString('<!doctype', $contents, $file);
            self::assertStringNotContainsString('<html', $contents, $file);
        }
    }

    public function testDevelopmentTreesAreOutsideThePublicDirectory(): void
    {
        foreach (['node_modules', 'src', 'tests'] as $directory) {
            self::assertDirectoryDoesNotExist(self::ROOT . '/public/' . $directory);
        }
    }

    /** @return list<string> */
    private function phpFiles(string $directory): array
    {
        if (!is_dir($directory)) {
            return [];
        }

        $files = [];
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = $file->getPathname();
            }
        }

        return $files;
    }
}
