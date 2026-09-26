<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Configuration\ConfigurationRepository;
use Flex\Contracts\Updates\RemotePackageTransportInterface;
use Flex\Updates\Exception\InvalidPlatformPackage;
use Flex\Updates\Remote\RemotePackageDownloader;
use Flex\Updates\Remote\RemoteReleaseManifest;
use PHPUnit\Framework\TestCase;

final class RemotePackageDownloaderTest extends TestCase
{
    private string $basePath;

    protected function setUp(): void
    {
        $this->basePath = sys_get_temp_dir() . '/flex-download-test-' . bin2hex(random_bytes(6));
        mkdir($this->basePath, 0770, true);
    }

    protected function tearDown(): void
    {
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->basePath, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($iterator as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }
        rmdir($this->basePath);
    }

    public function testItDownloadsAndVerifiesSizeAndChecksum(): void
    {
        $contents = 'verified update package';
        $release = $this->release($contents);
        $downloader = new RemotePackageDownloader($this->configuration(), new FakePackageTransport($contents), $this->basePath);

        $path = $downloader->download($release);

        self::assertFileExists($path);
        self::assertSame($contents, file_get_contents($path));
    }

    public function testItRejectsAHostOutsideTheConfiguredServer(): void
    {
        $release = RemoteReleaseManifest::fromArray([...$this->releaseData('package'), 'download_url' => 'https://evil.example/package.zip']);
        $downloader = new RemotePackageDownloader($this->configuration(), new FakePackageTransport('package'), $this->basePath);

        $this->expectExceptionMessage('outside the configured HTTPS update host');
        $downloader->download($release);
    }

    public function testItRejectsAChangedPackage(): void
    {
        $release = $this->release('expected package');
        $downloader = new RemotePackageDownloader($this->configuration(), new FakePackageTransport('changed package'), $this->basePath);

        $this->expectException(InvalidPlatformPackage::class);
        $this->expectExceptionMessage('checksum');
        $downloader->download($release);
    }

    private function configuration(): ConfigurationRepository
    {
        return new ConfigurationRepository(['extensions' => ['updates' => [
            'server_url' => 'https://updates.flex-cms.com',
            'max_download_mb' => 1,
            'require_signature' => false,
            'signing_public_key' => '',
        ]]]);
    }

    private function release(string $contents): RemoteReleaseManifest
    {
        return RemoteReleaseManifest::fromArray($this->releaseData($contents));
    }

    /** @return array<string, mixed> */
    private function releaseData(string $contents): array
    {
        return [
            'schema' => 1,
            'package' => 'flex-cms',
            'type' => 'platform',
            'version' => '1.1.0',
            'channel' => 'stable',
            'download_url' => 'https://updates.flex-cms.com/platform/releases/1.1.0/flex-cms-1.1.0.zip',
            'checksum' => hash('sha256', $contents),
            'size' => strlen($contents),
            'minimum_php' => '>=8.3',
            'compatible_from' => '>=1.0.0 <2.0.0',
            'published_at' => '2026-09-25T12:00:00+00:00',
            'release_notes' => 'Release notes.',
        ];
    }
}

final class FakePackageTransport implements RemotePackageTransportInterface
{
    public function __construct(private readonly string $contents) {}

    public function download(string $url, string $destination, int $maximumBytes): int
    {
        if (strlen($this->contents) > $maximumBytes) {
            throw new \RuntimeException('too large');
        }
        file_put_contents($destination, $this->contents, LOCK_EX);

        return strlen($this->contents);
    }
}
