<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Updates\Exception\InvalidRemoteReleaseManifest;
use Flex\Updates\Remote\RemoteReleaseManifest;
use Flex\Updates\Remote\UpdateChannel;
use PHPUnit\Framework\TestCase;

final class RemoteReleaseManifestTest extends TestCase
{
    public function testItValidatesAPlatformReleaseContract(): void
    {
        $manifest = RemoteReleaseManifest::fromArray($this->data());

        self::assertSame('flex-cms', $manifest->package);
        self::assertSame('platform', $manifest->type);
        self::assertSame('1.1.0', $manifest->version->value);
        self::assertSame(UpdateChannel::STABLE, $manifest->channel);
        self::assertSame($manifest->checksum, $manifest->signingData()['checksum']);
    }

    public function testItValidatesPluginReleaseIdentity(): void
    {
        $manifest = RemoteReleaseManifest::fromArray([
            ...$this->data(),
            'package' => 'flex/seo',
            'type' => 'plugin',
        ]);

        self::assertSame('flex/seo', $manifest->package);
        self::assertSame('plugin', $manifest->type);
    }

    /** @dataProvider invalidDataProvider */
    public function testItRejectsUnsafeOrInvalidContract(array $changes, string $message): void
    {
        $this->expectException(InvalidRemoteReleaseManifest::class);
        $this->expectExceptionMessage($message);

        RemoteReleaseManifest::fromArray([...$this->data(), ...$changes]);
    }

    /** @return iterable<string, array{array<string, mixed>, string}> */
    public static function invalidDataProvider(): iterable
    {
        yield 'http download' => [['download_url' => 'http://updates.flex-cms.com/platform.zip'], 'HTTPS'];
        yield 'invalid checksum' => [['checksum' => 'invalid'], 'checksum'];
        yield 'invalid channel' => [['channel' => 'nightly'], 'channel'];
        yield 'plugin package as platform' => [['package' => 'flex/seo'], 'Platform releases'];
        yield 'invalid published date' => [['published_at' => 'not-a-date'], 'published_at'];
    }

    /** @return array<string, mixed> */
    private function data(): array
    {
        return [
            'schema' => 1,
            'package' => 'flex-cms',
            'type' => 'platform',
            'version' => '1.1.0',
            'channel' => 'stable',
            'download_url' => 'https://updates.flex-cms.com/platform/releases/1.1.0/flex-cms-1.1.0.zip',
            'checksum' => str_repeat('a', 64),
            'size' => 1024,
            'minimum_php' => '>=8.3',
            'compatible_from' => '>=1.0.0 <2.0.0',
            'published_at' => '2026-09-25T12:00:00+00:00',
            'release_notes' => 'Initial remote release.',
            'signature_algorithm' => 'ed25519',
            'key_id' => 'release-2026',
        ];
    }
}
