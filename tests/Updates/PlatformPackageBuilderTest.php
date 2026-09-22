<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Updates\Platform\PlatformPackageBuilder;
use Flex\Updates\Platform\PlatformPackageBuildOptions;
use Flex\Updates\Platform\PlatformPackageInspector;
use Flex\Updates\Platform\PlatformVersionRegistry;
use PHPUnit\Framework\TestCase;
use ZipArchive;

final class PlatformPackageBuilderTest extends TestCase
{
    private string $basePath;

    protected function setUp(): void
    {
        $this->basePath = sys_get_temp_dir() . '/flex-builder-test-' . bin2hex(random_bytes(6));
        mkdir($this->basePath . '/src', 0770, true);
        mkdir($this->basePath . '/public/media', 0770, true);
        mkdir($this->basePath . '/public/build/admin/.vite', 0770, true);
        mkdir($this->basePath . '/resources/admin/node_modules/package', 0770, true);
        mkdir($this->basePath . '/resources/admin/.git', 0770, true);
        mkdir($this->basePath . '/resources/views', 0770, true);
        mkdir($this->basePath . '/src/Feature/.git', 0770, true);
        mkdir($this->basePath . '/tests', 0770, true);
        file_put_contents($this->basePath . '/platform.json', json_encode([
            'schema' => 1,
            'name' => 'flex-cms',
            'version' => '0.1.0-dev',
            'api_version' => '1.0',
        ], JSON_THROW_ON_ERROR));
        file_put_contents($this->basePath . '/src/example.php', '<?php return true;');
        file_put_contents($this->basePath . '/src/Feature/.git/config', 'must not ship');
        file_put_contents($this->basePath . '/tests/example.php', 'must not ship');
        file_put_contents($this->basePath . '/public/media/user.txt', 'must not ship');
        mkdir($this->basePath . '/public/private-dev', 0770, true);
        file_put_contents($this->basePath . '/public/build/admin/.vite/manifest.json', '{}');
        file_put_contents($this->basePath . '/public/build/admin/admin-hash.js', 'production asset');
        file_put_contents($this->basePath . '/public/private-dev/debug.txt', 'must not ship');
        file_put_contents($this->basePath . '/resources/admin/source.tsx', 'must not ship');
        file_put_contents($this->basePath . '/resources/admin/node_modules/package/index.js', 'must not ship');
        file_put_contents($this->basePath . '/resources/admin/.git/config', 'must not ship');
        file_put_contents($this->basePath . '/resources/views/runtime.php', '<?php return true;');
        file_put_contents($this->basePath . '/composer.json', '{}');
    }

    protected function tearDown(): void
    {
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->basePath, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($this->basePath);
    }

    public function testItBuildsAValidatedUnsignedPackage(): void
    {
        $output = $this->basePath . '/release.zip';
        $result = $this->builder()->build(new PlatformPackageBuildOptions(version: '0.1.1', outputPath: $output));

        self::assertSame('0.1.1', $result->version);
        self::assertFalse($result->signed);
        self::assertFileExists($output . '.sha256');

        $package = (new PlatformPackageInspector())->inspect($output, $result->checksum);
        self::assertSame('0.1.1', $package->manifest->version->value);

        $archive = new ZipArchive();
        self::assertTrue($archive->open($output));
        self::assertNotFalse($archive->getFromName('payload/src/example.php'));
        self::assertNotFalse($archive->getFromName('payload/resources/views/runtime.php'));
        self::assertNotFalse($archive->getFromName('payload/public/build/admin/admin-hash.js'));
        self::assertFalse($archive->statName('payload/public/private-dev/debug.txt'));
        self::assertFalse($archive->statName('payload/public/media/user.txt'));
        self::assertFalse($archive->statName('payload/resources/admin/source.tsx'));
        self::assertFalse($archive->statName('payload/resources/admin/node_modules/package/index.js'));
        self::assertFalse($archive->statName('payload/resources/admin/.git/config'));
        self::assertFalse($archive->statName('payload/src/Feature/.git/config'));
        self::assertFalse($archive->statName('payload/tests/example.php'));
        $manifest = json_decode((string) $archive->getFromName('manifest.json'), true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($manifest);
        self::assertSame($result->checksum, hash_file('sha256', $output));
        self::assertSame('0.1.1', $manifest['version']);
        self::assertSame(hash('sha256', '<?php return true;'), $manifest['files']['src/example.php']);
        self::assertStringContainsString($result->checksum, (string) file_get_contents($output . '.sha256'));
        $archive->close();
    }

    public function testItRefusesToBuildWithoutProductionAssets(): void
    {
        unlink($this->basePath . '/public/build/admin/.vite/manifest.json');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Production admin assets are missing');

        $this->builder()->build(new PlatformPackageBuildOptions(version: '0.1.1'));
    }

    public function testItBuildsASignedPackage(): void
    {
        $keys = sodium_crypto_sign_keypair();
        $privateKey = sodium_crypto_sign_secretkey($keys);
        $publicKey = sodium_crypto_sign_publickey($keys);
        $privatePath = $this->basePath . '/release.key';
        file_put_contents($privatePath, base64_encode($privateKey));
        $output = $this->basePath . '/signed.zip';

        $result = $this->builder()->build(new PlatformPackageBuildOptions(
            version: '0.1.1',
            privateKeyPath: $privatePath,
            keyId: 'test-key',
            outputPath: $output,
        ));

        $package = (new PlatformPackageInspector(
            signingPublicKey: base64_encode($publicKey),
            requireSignature: true,
        ))->inspect($output, $result->checksum);
        self::assertSame('test-key', $package->manifest->keyId);
    }

    private function builder(): PlatformPackageBuilder
    {
        return new PlatformPackageBuilder($this->basePath, new PlatformVersionRegistry($this->basePath));
    }
}
