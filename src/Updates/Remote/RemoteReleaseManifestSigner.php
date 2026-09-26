<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Updates\Exception\InvalidRemoteReleaseManifest;
use Flex\Updates\Platform\PlatformPackageSignature;

final class RemoteReleaseManifestSigner
{
    /** @param array<string, mixed> $manifest */
    public static function sign(array $manifest, string $privateKeyBase64, ?string $keyId = null): array
    {
        $manifest['signature_algorithm'] = PlatformPackageSignature::ALGORITHM;
        if ($keyId !== null && $keyId !== '') {
            $manifest['key_id'] = $keyId;
        }

        $validated = RemoteReleaseManifest::fromArray($manifest);
        $manifest['signature'] = PlatformPackageSignature::sign($validated->signingData(), trim($privateKeyBase64));

        return $manifest;
    }

    /** @param array<string, mixed> $manifest */
    public static function verify(array $manifest, string $publicKeyBase64): bool
    {
        try {
            $validated = RemoteReleaseManifest::fromArray($manifest);
        } catch (InvalidRemoteReleaseManifest) {
            return false;
        }

        if ($validated->signature === null || $validated->signatureAlgorithm !== PlatformPackageSignature::ALGORITHM) {
            return false;
        }

        return PlatformPackageSignature::verify($validated->signingData(), $validated->signature, trim($publicKeyBase64));
    }
}
