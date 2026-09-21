<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Contracts\Updates\PlatformDatabaseBackupInterface;
use Flex\Updates\Exception\PlatformUpdateException;

final readonly class PlatformUpdateRecovery
{
    public function __construct(
        private string $basePath,
        private PlatformUpdateStateStore $states,
        private ?PlatformDatabaseBackupInterface $databaseBackup = null,
    ) {}

    public function recover(): PlatformUpdateState
    {
        $state = $this->states->read();
        if ($state === null) {
            throw new PlatformUpdateException('No interrupted platform update was found.');
        }

        $lock = PlatformUpdateLock::acquire($this->basePath);
        try {
            $this->assertManagedPath($state->backupPath, '/storage/backups/platform/');
            $this->assertManagedPath($state->workPath, '/storage/tmp/');

            if ($state->phase === 'completed') {
                @unlink($this->basePath . '/storage/maintenance.json');
                $this->removeDirectory($state->workPath);
                $this->states->clear();

                return $state;
            }

            if (in_array($state->phase, ['migrations_running', 'health_checking'], true)) {
                if ($this->databaseBackup === null || $state->databaseBackupPath === null) {
                    throw new PlatformUpdateException('The interrupted update requires a database backup, but none is available.');
                }
                $this->assertManagedPath($state->databaseBackupPath, '/storage/backups/platform/');
                $this->databaseBackup->restore($state->databaseBackupPath);
            }

            foreach (array_reverse($state->affectedPaths) as $path) {
                $destination = $this->destination($path);
                $backup = $state->backupPath . '/files/' . $path;

                if (is_link($destination)) {
                    throw new PlatformUpdateException(sprintf('Recovery cannot operate through symbolic link "%s".', $path));
                }

                if (is_file($backup)) {
                    $this->ensureDirectory(dirname($destination));
                    if (!copy($backup, $destination)) {
                        throw new PlatformUpdateException(sprintf('Recovery could not restore "%s".', $path));
                    }
                } elseif (is_file($destination) && !unlink($destination)) {
                    throw new PlatformUpdateException(sprintf('Recovery could not remove newly installed file "%s".', $path));
                }
            }

            @unlink($this->basePath . '/storage/maintenance.json');
            $this->removeDirectory($state->workPath);
            $this->states->clear();

            return $state;
        } finally {
            $lock->release();
        }
    }

    private function destination(string $path): string
    {
        if ($path === '' || str_contains($path, "\0") || str_contains($path, '\\') || str_starts_with($path, '/')
            || in_array('.', explode('/', $path), true) || in_array('..', explode('/', $path), true)) {
            throw new PlatformUpdateException(sprintf('Recovery found an unsafe path "%s".', $path));
        }

        $destination = $this->basePath . '/' . $path;
        $cursor = $destination;
        while ($cursor !== $this->basePath && $cursor !== dirname($cursor)) {
            if (is_link($cursor)) {
                throw new PlatformUpdateException(sprintf('Recovery cannot write through symbolic link "%s".', $path));
            }
            $cursor = dirname($cursor);
        }

        return $destination;
    }

    private function assertManagedPath(string $path, string $suffix): void
    {
        $prefix = rtrim($this->basePath, '/') . $suffix;
        if (!str_starts_with($path, $prefix) || str_contains($path, "\0") || str_contains($path, '\\')
            || in_array('..', explode('/', $path), true) || in_array('.', explode('/', $path), true)) {
            throw new PlatformUpdateException('The platform update state contains an unsafe managed path.');
        }
    }

    private function ensureDirectory(string $path): void
    {
        if (!is_dir($path) && !mkdir($path, 0775, true) && !is_dir($path)) {
            throw new PlatformUpdateException(sprintf('Recovery cannot create directory "%s".', $path));
        }
    }

    private function removeDirectory(string $path): void
    {
        if (!is_dir($path)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $item) {
            if ($item->isDir() && !$item->isLink()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }
        @rmdir($path);
    }
}
