<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Updates\Remote\RemoteCatalogPublication;
use Flex\Updates\Remote\RemoteReleaseManifestSigner;
use PHPUnit\Framework\TestCase;
use RuntimeException;

final class RemoteCatalogPublicationTest extends TestCase
{
    public function testItPreservesSignedDatesAndUnicodeAndRecoversProvenTimezoneConversion(): void
    {
        $pair = sodium_crypto_sign_keypair();
        $public = base64_encode(sodium_crypto_sign_publickey($pair));
        $entry = RemoteReleaseManifestSigner::sign([
            'schema' => 1, 'package' => 'flex-cms', 'type' => 'platform', 'version' => '0.1.46',
            'channel' => 'stable', 'download_url' => 'https://updates.example.com/release.zip',
            'checksum' => str_repeat('a', 64), 'size' => 1024, 'minimum_php' => '>=8.3',
            'compatible_from' => '>=0.1.0 <1.0.0', 'published_at' => '2026-10-04T21:44:39+00:00',
            'release_notes' => 'Поправка на обновяването.',
        ], base64_encode(sodium_crypto_sign_secretkey($pair)), 'release-2026');
        $changed = $entry;
        $changed['published_at'] = '2026-10-05T00:44:39+03:00';
        self::assertFalse(RemoteReleaseManifestSigner::verify($changed, $public));
        $catalog = RemoteCatalogPublication::merge(['releases' => [$changed]], $entry, $public);
        self::assertSame([$entry], $catalog['releases']);
        $roundtrip = json_decode(json_encode($catalog, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue(RemoteReleaseManifestSigner::verify($roundtrip['releases'][0], $public));
        $changed['release_notes'] = 'Modified';
        $this->expectException(RuntimeException::class);
        RemoteCatalogPublication::merge(['releases' => [$changed]], $entry, $public);
    }
}
