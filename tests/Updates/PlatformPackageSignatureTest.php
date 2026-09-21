<?php

declare(strict_types=1);

namespace Flex\Tests\Updates;

use Flex\Updates\Platform\PlatformPackageSignature;
use PHPUnit\Framework\TestCase;

final class PlatformPackageSignatureTest extends TestCase
{
    public function testItSignsAndVerifiesCanonicalManifestData(): void
    {
        [$publicKey, $privateKey] = $this->keys();
        $manifest = [
            'run_migrations' => true,
            'files' => ['src/B.php' => str_repeat('b', 64), 'platform.json' => str_repeat('a', 64)],
            'package' => 'flex-cms',
            'schema' => 1,
            'version' => '1.1.0',
            'minimum_php' => '>=8.3',
            'compatible_from' => '>=1.0.0 <2.0.0',
            'remove' => ['src/Old.php'],
            'signature_algorithm' => 'ed25519',
            'key_id' => 'release-2026',
        ];

        $signature = PlatformPackageSignature::sign($manifest, base64_encode($privateKey));

        self::assertTrue(PlatformPackageSignature::verify($manifest, $signature, base64_encode($publicKey)));
        self::assertFalse(PlatformPackageSignature::verify([...$manifest, 'version' => '1.2.0'], $signature, base64_encode($publicKey)));
    }

    /** @return array{string, string} */
    private function keys(): array
    {
        $pair = sodium_crypto_sign_keypair();

        return [
            sodium_crypto_sign_publickey($pair),
            sodium_crypto_sign_secretkey($pair),
        ];
    }
}
