<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Updates\Platform\PlatformVersion;
use Flex\Updates\Remote\RemoteCatalog;
use Flex\Updates\Remote\RemotePlatformUpdater;
use Flex\Updates\Remote\RemoteReleaseManifest;
use PHPUnit\Framework\TestCase;

final class RemotePlatformUpdaterTest extends TestCase
{
    public function testItSelectsTheHighestCompatibleReleaseForTheConfiguredChannel(): void
    {
        $catalog = new RemoteCatalog(1, 'flex-cms', 'platform', [
            $this->release('1.1.0', 'stable'),
            $this->release('1.3.0', 'stable'),
            $this->release('2.0.0', 'stable', '>=2.0.0 <3.0.0'),
            $this->release('1.2.0', 'beta'),
        ]);

        $selected = RemotePlatformUpdater::selectLatest($catalog, new PlatformVersion('1.0.0'), 'stable');

        self::assertInstanceOf(RemoteReleaseManifest::class, $selected);
        self::assertSame('1.3.0', $selected->version->value);
    }

    private function release(string $version, string $channel, string $compatibleFrom = '>=1.0.0 <2.0.0'): RemoteReleaseManifest
    {
        return RemoteReleaseManifest::fromArray([
            'schema' => 1,
            'package' => 'flex-cms',
            'type' => 'platform',
            'version' => $version,
            'channel' => $channel,
            'download_url' => 'https://updates.flex-cms.com/platform/releases/' . $version . '/flex-cms-' . $version . '.zip',
            'checksum' => str_repeat('a', 64),
            'size' => 1024,
            'minimum_php' => '>=' . PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
            'compatible_from' => $compatibleFrom,
            'published_at' => '2026-09-25T12:00:00+00:00',
            'release_notes' => '',
        ]);
    }
}
