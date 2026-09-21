<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Updates\Exception\InvalidPlatformPackage;

final readonly class PlatformPreflightChecker
{
    /** @var list<string> */
    private const CORE_EXTENSIONS = ['hash', 'json', 'sodium', 'zip'];

    public function __construct(private string $basePath) {}

    public function assertReady(InspectedPlatformPackage $package): void
    {
        $this->assertExtensions($package->manifest->requiredExtensions);
        $this->assertWritablePath($this->basePath . '/storage');
        $this->assertWritablePath($this->basePath . '/storage/tmp');
        $this->assertWritablePath($this->basePath . '/storage/backups');
        $this->assertWritablePath($this->basePath . '/storage/updates');

        foreach (array_keys($package->manifest->files) as $path) {
            $this->assertSafeDestination($path);
            $this->assertWritablePath(dirname($this->basePath . '/' . $path));
        }
        foreach ($package->manifest->remove as $path) {
            $this->assertSafeDestination($path);
        }

        if ($package->manifest->runMigrations) {
            $migrationPath = $this->basePath . '/database/migrations';
            if (!is_dir($migrationPath)) {
                throw new InvalidPlatformPackage('Database migrations are enabled but the migration directory is missing.');
            }
            $this->assertWritablePath($migrationPath);
        }

        $freeBytes = disk_free_space($this->basePath);
        $packageBytes = filesize($package->path);
        if ($freeBytes === false || $packageBytes === false) {
            throw new InvalidPlatformPackage('The available disk space cannot be determined.');
        }

        $requiredBytes = max(1_048_576, $packageBytes + ($package->uncompressedBytes * 2));
        if ($freeBytes < $requiredBytes) {
            throw new InvalidPlatformPackage(sprintf(
                'Insufficient disk space for the update. Required at least %d bytes, available %d bytes.',
                $requiredBytes,
                $freeBytes,
            ));
        }
    }

    /** @param list<string> $requiredExtensions */
    private function assertExtensions(array $requiredExtensions): void
    {
        foreach (array_unique([...self::CORE_EXTENSIONS, ...$requiredExtensions]) as $extension) {
            if (!extension_loaded($extension)) {
                throw new InvalidPlatformPackage(sprintf('The PHP extension "%s" is required for this update.', $extension));
            }
        }
    }

    private function assertWritablePath(string $path): void
    {
        $cursor = $path;
        while (!is_dir($cursor)) {
            $parent = dirname($cursor);
            if ($parent === $cursor) {
                throw new InvalidPlatformPackage(sprintf('The directory "%s" cannot be created.', $path));
            }
            $cursor = $parent;
        }

        if (!is_writable($cursor)) {
            throw new InvalidPlatformPackage(sprintf('The directory "%s" is not writable.', $path));
        }
    }

    private function assertSafeDestination(string $path): void
    {
        if ($path === '' || str_contains($path, "\0") || str_contains($path, '\\') || str_starts_with($path, '/')
            || in_array('.', explode('/', $path), true) || in_array('..', explode('/', $path), true)) {
            throw new InvalidPlatformPackage(sprintf('The update path "%s" is unsafe.', $path));
        }

        $cursor = $this->basePath . '/' . $path;
        while ($cursor !== $this->basePath && $cursor !== dirname($cursor)) {
            if (is_link($cursor)) {
                throw new InvalidPlatformPackage(sprintf('The update path "%s" passes through a symbolic link.', $path));
            }
            $cursor = dirname($cursor);
        }
    }
}
