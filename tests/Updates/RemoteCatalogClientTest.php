<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Configuration\ConfigurationRepository;
use Flex\Contracts\Updates\RemoteCatalogTransportInterface;
use Flex\Contracts\Updates\RemoteCatalogTransportResponse;
use Flex\Updates\Exception\RemoteCatalogException;
use Flex\Updates\Remote\RemoteCatalogClient;
use PHPUnit\Framework\TestCase;

final class RemoteCatalogClientTest extends TestCase
{
    private string $basePath;

    protected function setUp(): void
    {
        $this->basePath = sys_get_temp_dir() . '/flex-catalog-test-' . bin2hex(random_bytes(6));
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

    public function testItFetchesPlatformCatalogAndUsesConditionalHeaders(): void
    {
        $transport = new FakeCatalogTransport([
            'https://updates.flex-cms.com/platform/manifest.json' => [
                new RemoteCatalogTransportResponse(200, json_encode($this->platformCatalog(), JSON_THROW_ON_ERROR), ['etag' => '"platform-v1"']),
                new RemoteCatalogTransportResponse(304, '', []),
            ],
        ]);
        $client = $this->client($transport);

        self::assertSame('1.1.0', $client->platformCatalog()->releases[0]->version->value);
        self::assertSame('"platform-v1"', $transport->requests[1]['headers'][1]);
        self::assertSame('1.1.0', $client->platformCatalog()->releases[0]->version->value);
    }

    public function testItFetchesPluginManifestFromTheIndex(): void
    {
        $transport = new FakeCatalogTransport([
            'https://updates.flex-cms.com/plugins/index.json' => [new RemoteCatalogTransportResponse(200, json_encode([
                'schema' => 1,
                'repository' => 'flex-cms',
                'type' => 'plugin',
                'plugins' => [['id' => 'flex/seo', 'manifest_url' => 'https://updates.flex-cms.com/plugins/flex/seo/manifest.json']],
            ], JSON_THROW_ON_ERROR))],
            'https://updates.flex-cms.com/plugins/flex/seo/manifest.json' => [new RemoteCatalogTransportResponse(200, json_encode([
                'schema' => 1,
                'repository' => 'flex-cms',
                'type' => 'plugin',
                'releases' => [$this->release('flex/seo', 'plugin')],
            ], JSON_THROW_ON_ERROR))],
        ]);

        self::assertSame('flex/seo', $this->client($transport)->pluginManifest('flex/seo')->releases[0]->package);
    }

    public function testItRejectsAnInsecureUpdateServer(): void
    {
        $this->expectException(RemoteCatalogException::class);
        $this->expectExceptionMessage('HTTPS');

        $this->client(new FakeCatalogTransport([]), 'http://updates.flex-cms.com')->platformCatalog();
    }

    private function client(RemoteCatalogTransportInterface $transport, string $serverUrl = 'https://updates.flex-cms.com'): RemoteCatalogClient
    {
        return new RemoteCatalogClient(
            new ConfigurationRepository(['extensions' => ['updates' => ['server_url' => $serverUrl]]]),
            $transport,
            $this->basePath,
        );
    }

    /** @return array<string, mixed> */
    private function platformCatalog(): array
    {
        return [
            'schema' => 1,
            'repository' => 'flex-cms',
            'type' => 'platform',
            'releases' => [$this->release('flex-cms', 'platform')],
        ];
    }

    /** @return array<string, mixed> */
    private function release(string $package, string $type): array
    {
        return [
            'schema' => 1,
            'package' => $package,
            'type' => $type,
            'version' => '1.1.0',
            'channel' => 'stable',
            'download_url' => 'https://updates.flex-cms.com/releases/1.1.0/package.zip',
            'checksum' => str_repeat('a', 64),
            'size' => 1024,
            'minimum_php' => '>=8.3',
            'compatible_from' => '>=1.0.0 <2.0.0',
            'published_at' => '2026-09-25T12:00:00+00:00',
            'release_notes' => 'Release notes.',
        ];
    }
}

final class FakeCatalogTransport implements RemoteCatalogTransportInterface
{
    /** @var array<string, list<RemoteCatalogTransportResponse>> */
    private array $responses;

    /** @var list<array{url: string, headers: list<string>}> */
    public array $requests = [];

    /** @param array<string, list<RemoteCatalogTransportResponse>> $responses */
    public function __construct(array $responses)
    {
        $this->responses = $responses;
    }

    public function get(string $url, array $headers = []): RemoteCatalogTransportResponse
    {
        $this->requests[] = ['url' => $url, 'headers' => array_values($headers)];
        if (($this->responses[$url] ?? []) === []) {
            throw new RemoteCatalogException(sprintf('Unexpected request to %s.', $url));
        }

        return array_shift($this->responses[$url]);
    }
}
