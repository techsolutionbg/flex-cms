<?php

declare(strict_types=1);

namespace Flex\Tests\Http;

use Flex\Http\AssetVersion;
use Flex\Http\Controller\ExtensionFrontendAssetController;
use PHPUnit\Framework\TestCase;

final class AssetVersionTest extends TestCase
{
    public function testVersionFollowsTheFileAndOnlyTheCurrentOneIsImmutable(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'flex-asset-');
        try {
            file_put_contents($file, 'a{}');
            $first = AssetVersion::of($file);
            self::assertMatchesRegularExpression('/^[a-f0-9]{12}$/', (string) $first);
            self::assertSame($first, AssetVersion::of($file));
            self::assertTrue(AssetVersion::matches($file, $first));
            self::assertFalse(AssetVersion::matches($file, '3'));
            self::assertFalse(AssetVersion::matches($file, null));
            self::assertFalse(AssetVersion::matches($file, ['x']));

            file_put_contents($file, 'a{color:red}');
            clearstatcache();
            self::assertNotSame($first, AssetVersion::of($file));
            self::assertFalse(AssetVersion::matches($file, $first), 'an old URL is no longer cached for good');
        } finally {
            unlink($file);
        }
        self::assertNull(AssetVersion::of($file));
        self::assertNull(AssetVersion::of(sys_get_temp_dir()), 'directories have no version');
    }

    public function testModulesChangeVersionWhenAnImportedModuleChangesAndImportsGetThatVersion(): void
    {
        $directory = sys_get_temp_dir() . '/flex-modules-' . bin2hex(random_bytes(6));
        mkdir($directory . '/vendor', 0777, true);
        try {
            file_put_contents($directory . '/main.js', "import { cart } from './cart.js?v=10';\nimport('./lazy.js');\nimport x from '/assets/flex-time.js';\n");
            file_put_contents($directory . '/cart.js', "import { toast } from \"./vendor/toast.js\";\nexport const cart = 1;\n");
            file_put_contents($directory . '/vendor/toast.js', 'export const toast = 1;');
            file_put_contents($directory . '/lazy.js', 'export default 1;');
            $main = AssetVersion::ofModule($directory . '/main.js');
            self::assertNotSame(AssetVersion::of($directory . '/main.js'), $main, 'the version covers the imports');
            self::assertSame($main, AssetVersion::forUrl($directory . '/main.js'));

            $served = ExtensionFrontendAssetController::versionImports((string) file_get_contents($directory . '/main.js'), $directory);
            self::assertStringContainsString("from './cart.js?v=" . AssetVersion::ofModule($directory . '/cart.js') . "'", $served);
            self::assertStringContainsString("import('./lazy.js?v=" . AssetVersion::of($directory . '/lazy.js') . "')", $served);
            self::assertStringContainsString("from '/assets/flex-time.js'", $served, 'absolute imports are left alone');

            // A change two modules down gives the entry module a new version, so its cached copy is not reused.
            file_put_contents($directory . '/vendor/toast.js', 'export const toast = 22;');
            clearstatcache();
            self::assertNotSame($main, AssetVersion::ofModule($directory . '/main.js'));
        } finally {
            foreach (['vendor/toast.js', 'cart.js', 'lazy.js', 'main.js'] as $file) {
                unlink($directory . '/' . $file);
            }
            rmdir($directory . '/vendor');
            rmdir($directory);
        }
    }
}
