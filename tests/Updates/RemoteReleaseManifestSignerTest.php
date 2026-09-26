<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Updates\Remote\RemoteReleaseManifestSigner;
use PHPUnit\Framework\TestCase;

final class RemoteReleaseManifestSignerTest extends TestCase
{
    public function testItSignsAndVerifiesAReleaseManifest(): void
    {
        $pair = sodium_crypto_sign_keypair();
        $manifest = [
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
            'release_notes' => 'Release notes.',
        ];

        $signed = RemoteReleaseManifestSigner::sign($manifest, base64_encode(sodium_crypto_sign_secretkey($pair)), 'release-2026');

        self::assertSame('ed25519', $signed['signature_algorithm']);
        self::assertTrue(RemoteReleaseManifestSigner::verify($signed, base64_encode(sodium_crypto_sign_publickey($pair))));
        self::assertFalse(RemoteReleaseManifestSigner::verify([...$signed, 'version' => '1.2.0'], base64_encode(sodium_crypto_sign_publickey($pair))));
    }
}
