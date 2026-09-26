<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Updates\RemotePackageTransportInterface;
use Flex\Updates\Exception\InvalidPlatformPackage;
use Flex\Updates\Exception\RemoteCatalogException;
use Flex\Updates\Platform\PlatformPackageSignature;

final class RemotePackageDownloader
{
    public function __construct(
        private readonly ConfigRepositoryInterface $configuration,
        private readonly RemotePackageTransportInterface $transport,
        private readonly string $basePath,
    ) {}

    public function download(RemoteReleaseManifest $release): string
    {
        $this->assertRelease($release);
        $maximumBytes = max(1, $this->configuration->int('extensions.updates.max_download_mb')) * 1024 * 1024;
        if ($release->size > $maximumBytes) {
            throw new InvalidPlatformPackage('The update package exceeds the configured download limit.');
        }

        $directory = $this->basePath . '/storage/tmp';
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new RemoteCatalogException('The update package staging directory cannot be created.');
        }
        $temporary = $directory . '/remote-update-' . bin2hex(random_bytes(8)) . '.zip.part';
        $final = substr($temporary, 0, -5);

        try {
            $bytes = $this->transport->download($release->downloadUrl, $temporary, $maximumBytes);
            if ($bytes !== $release->size || filesize($temporary) !== $release->size) {
                throw new InvalidPlatformPackage('The downloaded update package size does not match its manifest.');
            }
            $checksum = hash_file('sha256', $temporary);
            if ($checksum === false || !hash_equals($release->checksum, $checksum)) {
                throw new InvalidPlatformPackage('The downloaded update package checksum does not match its manifest.');
            }
            if (!rename($temporary, $final)) {
                throw new RemoteCatalogException('The downloaded update package cannot be finalized.');
            }

            return $final;
        } catch (\Throwable $exception) {
            @unlink($temporary);
            @unlink($final);
            throw $exception;
        }
    }

    private function assertRelease(RemoteReleaseManifest $release): void
    {
        $parts = parse_url($release->downloadUrl);
        $server = parse_url(rtrim($this->configuration->string('extensions.updates.server_url'), '/'));
        if (!is_array($parts) || !is_array($server)
            || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || strtolower((string) ($parts['host'] ?? '')) !== strtolower((string) ($server['host'] ?? ''))
            || isset($parts['user'], $parts['pass'], $parts['port'])) {
            throw new RemoteCatalogException('The update package URL is outside the configured HTTPS update host.');
        }

        $publicKey = trim($this->configuration->string('extensions.updates.signing_public_key'));
        $requireSignature = $this->configuration->bool('extensions.updates.require_signature');
        if ($release->signature === null) {
            if ($requireSignature) {
                throw new InvalidPlatformPackage('The remote update manifest signature is required.');
            }

            return;
        }
        if ($publicKey === '' || $release->signatureAlgorithm !== PlatformPackageSignature::ALGORITHM
            || !RemoteReleaseManifestSigner::verify($release->signingData() + ['signature' => $release->signature], $publicKey)) {
            throw new InvalidPlatformPackage('The remote update manifest signature is invalid.');
        }
    }
}
