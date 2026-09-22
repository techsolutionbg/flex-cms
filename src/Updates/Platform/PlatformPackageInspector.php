<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Updates\Exception\InvalidPlatformPackage;
use ZipArchive;

final readonly class PlatformPackageInspector
{
    /** @var list<string> */
    private const PROTECTED_PATHS = [
        '.env',
        '.git',
        'plugins',
        'public/media',
        'storage',
        'themes',
    ];

    public function __construct(
        private int $maximumUncompressedBytes = 268_435_456,
        private ?string $signingPublicKey = null,
        private bool $requireSignature = false,
    ) {}

    public function inspect(string $packagePath, ?string $expectedChecksum = null): InspectedPlatformPackage
    {
        if (!is_file($packagePath) || !is_readable($packagePath)) {
            throw new InvalidPlatformPackage('The platform package does not exist or is unreadable.');
        }

        $checksum = hash_file('sha256', $packagePath);
        if ($checksum === false) {
            throw new InvalidPlatformPackage('The platform package checksum cannot be calculated.');
        }

        if ($expectedChecksum !== null && !hash_equals(strtolower($expectedChecksum), $checksum)) {
            throw new InvalidPlatformPackage('The platform package checksum does not match.');
        }

        $archive = new ZipArchive();
        if ($archive->open($packagePath, ZipArchive::RDONLY) !== true) {
            throw new InvalidPlatformPackage('The platform package is not a readable ZIP archive.');
        }

        try {
            $manifest = $this->readManifest($archive);
            $uncompressedBytes = $this->validateArchive($archive, $manifest);
        } finally {
            $archive->close();
        }

        return new InspectedPlatformPackage($packagePath, $checksum, $manifest, $uncompressedBytes);
    }

    private function readManifest(ZipArchive $archive): PlatformPackageManifest
    {
        $contents = $archive->getFromName('manifest.json');
        if ($contents === false) {
            throw new InvalidPlatformPackage('The package manifest.json file is missing.');
        }

        try {
            $data = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new InvalidPlatformPackage('The package manifest contains invalid JSON.', 0, $exception);
        }

        if (!is_array($data)) {
            throw new InvalidPlatformPackage('The package manifest must contain a JSON object.');
        }

        return PlatformPackageManifest::fromArray($data);
    }

    private function validateArchive(ZipArchive $archive, PlatformPackageManifest $manifest): int
    {
        $this->validateSignature($manifest);
        $seenFiles = [];
        $uncompressedBytes = 0;

        for ($index = 0; $index < $archive->numFiles; ++$index) {
            $stat = $archive->statIndex($index);
            if ($stat === false) {
                throw new InvalidPlatformPackage('The ZIP archive contains an unreadable entry.');
            }

            $entry = $stat['name'];
            $this->assertSafeArchiveEntry($entry);

            $size = $stat['size'];
            if ($size < 0) {
                throw new InvalidPlatformPackage(sprintf('Invalid size for ZIP entry "%s".', $entry));
            }

            $uncompressedBytes += $size;
            if ($uncompressedBytes > $this->maximumUncompressedBytes) {
                throw new InvalidPlatformPackage('The uncompressed platform package is too large.');
            }

            if ($this->isSymlink($archive, $index)) {
                throw new InvalidPlatformPackage(sprintf('Symbolic links are not allowed in platform packages: "%s".', $entry));
            }

            if ($entry === 'manifest.json') {
                continue;
            }

            if (str_ends_with($entry, '/')) {
                if ($entry !== 'payload/' && !str_starts_with($entry, 'payload/')) {
                    throw new InvalidPlatformPackage(sprintf('Unexpected package directory "%s".', $entry));
                }
                continue;
            }

            if (!str_starts_with($entry, 'payload/')) {
                throw new InvalidPlatformPackage(sprintf('Unexpected package entry "%s".', $entry));
            }

            $path = substr($entry, 8);
            $this->assertSafePlatformPath($path);

            if (isset($seenFiles[$path])) {
                throw new InvalidPlatformPackage(sprintf('Duplicate package file "%s".', $path));
            }

            $expectedFileChecksum = $manifest->files[$path] ?? null;
            if ($expectedFileChecksum === null) {
                throw new InvalidPlatformPackage(sprintf('Package file "%s" is missing from the manifest.', $path));
            }

            $contents = $archive->getFromIndex($index);
            if ($contents === false || !hash_equals($expectedFileChecksum, hash('sha256', $contents))) {
                throw new InvalidPlatformPackage(sprintf('Checksum verification failed for "%s".', $path));
            }

            $seenFiles[$path] = true;
        }

        foreach ($manifest->files as $path => $_checksum) {
            $this->assertSafePlatformPath($path);
            if (!isset($seenFiles[$path])) {
                throw new InvalidPlatformPackage(sprintf('Manifest file "%s" is missing from the ZIP archive.', $path));
            }
        }

        foreach ($manifest->remove as $path) {
            $this->assertSafePlatformPath($path);
            if (isset($manifest->files[$path])) {
                throw new InvalidPlatformPackage(sprintf('Path "%s" cannot be updated and removed in the same package.', $path));
            }
        }

        $this->validatePlatformManifest($archive, $manifest);

        return $uncompressedBytes;
    }

    private function validateSignature(PlatformPackageManifest $manifest): void
    {
        if ($manifest->signature === null) {
            if ($this->requireSignature) {
                throw new InvalidPlatformPackage('The platform package signature is required.');
            }

            return;
        }

        if ($this->signingPublicKey === null || $manifest->signatureAlgorithm !== PlatformPackageSignature::ALGORITHM
            || !PlatformPackageSignature::verify($manifest->signingData(), $manifest->signature, $this->signingPublicKey)) {
            throw new InvalidPlatformPackage('The platform package signature is invalid.');
        }
    }

    private function validatePlatformManifest(ZipArchive $archive, PlatformPackageManifest $manifest): void
    {
        if (!isset($manifest->files['platform.json'])) {
            throw new InvalidPlatformPackage('Every platform package must contain platform.json.');
        }

        $contents = $archive->getFromName('payload/platform.json');
        if ($contents === false) {
            throw new InvalidPlatformPackage('The platform.json payload is missing.');
        }

        try {
            $platform = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new InvalidPlatformPackage('The platform.json payload contains invalid JSON.', 0, $exception);
        }

        if (!is_array($platform) || ($platform['name'] ?? null) !== 'flex-cms' || ($platform['version'] ?? null) !== $manifest->version->value) {
            throw new InvalidPlatformPackage('The platform.json version does not match the package manifest.');
        }
    }

    private function assertSafeArchiveEntry(string $entry): void
    {
        if ($entry === '' || str_contains($entry, "\0") || str_contains($entry, '\\') || str_starts_with($entry, '/')) {
            throw new InvalidPlatformPackage(sprintf('Unsafe ZIP entry "%s".', $entry));
        }

        foreach (explode('/', rtrim($entry, '/')) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                throw new InvalidPlatformPackage(sprintf('Unsafe ZIP entry "%s".', $entry));
            }
        }
    }

    private function assertSafePlatformPath(string $path): void
    {
        $this->assertSafeArchiveEntry($path);

        foreach (self::PROTECTED_PATHS as $protectedPath) {
            if ($path === $protectedPath || str_starts_with($path, $protectedPath . '/')) {
                throw new InvalidPlatformPackage(sprintf('The protected path "%s" cannot be changed by a platform package.', $path));
            }
        }
    }

    private function isSymlink(ZipArchive $archive, int $index): bool
    {
        $operationsSystem = 0;
        $attributes = 0;

        if (!$archive->getExternalAttributesIndex($index, $operationsSystem, $attributes)) {
            return false;
        }

        return (($attributes >> 16) & 0o170000) === 0o120000;
    }
}
