<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Updates\Exception\InvalidPlatformPackage;

final class PlatformPackageSignature
{
    public const ALGORITHM = 'ed25519';

    /** @param array<string, mixed> $manifest */
    public static function canonicalManifest(array $manifest): string
    {
        unset($manifest['signature']);
        self::sortKeys($manifest);

        return json_encode($manifest, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    /** @param array<string, mixed> $manifest */
    public static function sign(array $manifest, string $privateKeyBase64): string
    {
        $privateKey = self::decodeKey($privateKeyBase64, SODIUM_CRYPTO_SIGN_SECRETKEYBYTES, 'private');

        return base64_encode(sodium_crypto_sign_detached(self::canonicalManifest($manifest), $privateKey));
    }

    /** @param array<string, mixed> $manifest */
    public static function verify(array $manifest, string $signatureBase64, string $publicKeyBase64): bool
    {
        try {
            $signature = self::decodeKey($signatureBase64, SODIUM_CRYPTO_SIGN_BYTES, 'signature');
            $publicKey = self::decodeKey($publicKeyBase64, SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES, 'public');
        } catch (InvalidPlatformPackage) {
            return false;
        }

        return sodium_crypto_sign_verify_detached($signature, self::canonicalManifest($manifest), $publicKey);
    }

    /** @return non-empty-string */
    private static function decodeKey(string $value, int $expectedBytes, string $label): string
    {
        $decoded = base64_decode($value, true);
        if ($decoded === false || $decoded === '' || strlen($decoded) !== $expectedBytes) {
            throw new InvalidPlatformPackage(sprintf('The %s Ed25519 key or signature is invalid.', $label));
        }

        return $decoded;
    }

    /** @param array<string, mixed> $value */
    private static function sortKeys(array &$value): void
    {
        foreach ($value as &$item) {
            if (is_array($item) && self::isAssociative($item)) {
                self::sortKeys($item);
            }
        }
        unset($item);

        if (self::isAssociative($value)) {
            ksort($value, SORT_STRING);
        }
    }

    /** @param array<mixed> $value */
    private static function isAssociative(array $value): bool
    {
        return array_keys($value) !== range(0, count($value) - 1);
    }
}
