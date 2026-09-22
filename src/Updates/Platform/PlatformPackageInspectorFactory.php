<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;

final readonly class PlatformPackageInspectorFactory
{
    public function __construct(
        private ConfigRepositoryInterface $configuration,
    ) {}

    public function create(): PlatformPackageInspector
    {
        $megabytes = max(1, $this->configuration->int('extensions.updates.max_uncompressed_mb'));
        $publicKey = $this->configuration->string('extensions.updates.signing_public_key');

        return new PlatformPackageInspector(
            maximumUncompressedBytes: $megabytes * 1024 * 1024,
            signingPublicKey: $publicKey !== '' ? $publicKey : null,
            requireSignature: $this->configuration->bool('extensions.updates.require_signature'),
        );
    }
}
