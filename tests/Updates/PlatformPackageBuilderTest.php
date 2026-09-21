<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Updates\Platform\PlatformPackageBuildOptions;
use Flex\Updates\Platform\PlatformPackageBuilder;
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
        file_put_contents($this->basePath . '/platform.json', json_encode([
            'schema' => 1,
            'name' => 'flex-cms',
            'version' => '0.1.0-dev',
            'api_version' => '1.0',
        ], JSON_THROW_ON_ERROR));
        file_put_contents($this->basePath . '/src/example.php', '<?php return true;');
        file_put_contents($this->basePath . '/public/media/user.txt', 'must not ship');
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
        self::assertFalse($archive->statName('payload/public/media/user.txt'));
        $archive->close();
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
