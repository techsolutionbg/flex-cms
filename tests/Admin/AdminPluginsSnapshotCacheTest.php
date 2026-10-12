<?php

declare(strict_types=1);

namespace Flex\Tests\Admin;

use Flex\Admin\AdminPluginsSnapshotCache;
use Nyholm\Psr7\ServerRequest;
use PHPUnit\Framework\TestCase;

final class AdminPluginsSnapshotCacheTest extends TestCase
{
    private string $basePath;

    protected function setUp(): void
    {
        $this->basePath = sys_get_temp_dir() . '/flex-plugins-snapshot-' . bin2hex(random_bytes(4));
        mkdir($this->basePath . '/storage/cache/admin', 0777, true);
    }

    protected function tearDown(): void
    {
        $path = $this->basePath . '/storage/cache/admin/plugins-snapshot.json';
        if (is_file($path)) {
            unlink($path);
        }
    }

    public function testWriteReadAndExpire(): void
    {
        $cache = new AdminPluginsSnapshotCache($this->basePath);
        self::assertNull($cache->read());
        $cache->write([['id' => 'flex/demo', 'name' => 'Demo']]);
        self::assertSame('flex/demo', $cache->read()[0]['id']);
        $path = $this->basePath . '/storage/cache/admin/plugins-snapshot.json';
        $payload = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $payload['stored_at'] = time() - 400;
        file_put_contents($path, json_encode($payload, JSON_THROW_ON_ERROR));
        self::assertNull($cache->read());
    }

    public function testHardRefreshQueryParam(): void
    {
        $cache = new AdminPluginsSnapshotCache($this->basePath);
        $request = new ServerRequest('GET', '/api/admin/plugins', [], null, '1.1', ['QUERY_STRING' => 'refresh=1']);
        $request = $request->withQueryParams(['refresh' => '1']);
        self::assertTrue($cache->wantsHardRefresh($request));
    }
}
