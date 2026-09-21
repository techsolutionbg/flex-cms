<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Contracts\Updates\PlatformDatabaseBackupInterface;
use Flex\Updates\Exception\PlatformUpdateException;

final readonly class PlatformRollback
{
    public function __construct(
        private string $basePath,
        private PlatformHistory $history,
        private PlatformVersionRegistry $versions,
        private ?PlatformDatabaseBackupInterface $databaseBackup = null,
    ) {}

    /** @return array<string, mixed> */
    public function rollback(string $id): array
    {
        $record = $this->history->find($id);
        $to = $record['to'] ?? null;
        if (!is_string($to) || $this->versions->current()->value !== $to) {
            throw new PlatformUpdateException('Only the currently installed platform update can be rolled back.');
        }

        $backup = $record['backup'] ?? null;
        $paths = $record['affected_paths'] ?? null;
        if (!is_string($backup) || !is_array($paths)) {
            throw new PlatformUpdateException('The update history record is missing rollback metadata.');
        }
        $this->assertManagedPath($backup, '/storage/backups/platform/');
        if (($record['migrations_ran'] ?? false) === true) {
            $databaseBackup = $record['database_backup'] ?? null;
            if ($this->databaseBackup === null || !is_string($databaseBackup) || !is_file($databaseBackup)) {
                throw new PlatformUpdateException('This update ran database migrations but has no usable database backup.');
            }
            $this->assertManagedPath($databaseBackup, '/storage/backups/platform/');
        }

        $lock = PlatformUpdateLock::acquire($this->basePath);
        $maintenancePath = $this->basePath . '/storage/maintenance.json';
        $completed = false;
        try {
            $maintenance = json_encode([
                'reason' => 'platform-rollback',
                'from' => $record['to'],
                'to' => $record['from'],
                'started_at' => gmdate(DATE_ATOM),
            ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
            if (file_put_contents($maintenancePath, $maintenance . PHP_EOL, LOCK_EX) === false) {
                throw new PlatformUpdateException('Platform rollback maintenance mode cannot be enabled.');
            }
            if (($record['migrations_ran'] ?? false) === true) {
                $this->databaseBackup->restore((string) $record['database_backup']);
            }
            foreach (array_reverse($paths) as $path) {
                if (!is_string($path)) {
                    throw new PlatformUpdateException('The rollback metadata contains an invalid path.');
                }
                $destination = $this->destination($path);
                $backupFile = $backup . '/files/' . $path;
                if (is_file($backupFile)) {
                    $this->ensureDirectory(dirname($destination));
                    if (!copy($backupFile, $destination)) {
                        throw new PlatformUpdateException(sprintf('Rollback could not restore "%s".', $path));
                    }
                } elseif (is_file($destination) && !unlink($destination)) {
                    throw new PlatformUpdateException(sprintf('Rollback could not remove "%s".', $path));
                }
            }

            $this->appendRollbackHistory($record, $id);
            $completed = true;
        } finally {
            if ($completed) {
                @unlink($maintenancePath);
            }
            $lock->release();
        }

        return $record;
    }

    /** @param array<string, mixed> $record */
    private function appendRollbackHistory(array $record, string $id): void
    {
        $directory = $this->basePath . '/storage/updates';
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new PlatformUpdateException('The platform update history directory cannot be created.');
        }
        $entry = json_encode([
            'type' => 'platform_rollback',
            'id' => $id,
            'from' => $record['to'],
            'to' => $record['from'],
            'rolled_back_at' => gmdate(DATE_ATOM),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        if (file_put_contents($directory . '/history.jsonl', $entry . PHP_EOL, FILE_APPEND | LOCK_EX) === false) {
            throw new PlatformUpdateException('The platform rollback history cannot be written.');
        }
    }

    private function assertManagedPath(string $path, string $suffix): void
    {
        $prefix = rtrim($this->basePath, '/') . $suffix;
        if (!str_starts_with($path, $prefix) || str_contains($path, "\0") || str_contains($path, '\\')
            || in_array('.', explode('/', $path), true) || in_array('..', explode('/', $path), true)) {
            throw new PlatformUpdateException('The rollback metadata contains an unsafe backup path.');
        }
    }

    private function destination(string $path): string
    {
        if ($path === '' || str_contains($path, "\0") || str_contains($path, '\\') || str_starts_with($path, '/')
            || in_array('.', explode('/', $path), true) || in_array('..', explode('/', $path), true)) {
            throw new PlatformUpdateException(sprintf('The rollback path "%s" is unsafe.', $path));
        }
        $destination = $this->basePath . '/' . $path;
        $cursor = $destination;
        while ($cursor !== $this->basePath && $cursor !== dirname($cursor)) {
            if (is_link($cursor)) {
                throw new PlatformUpdateException(sprintf('Rollback cannot write through symbolic link "%s".', $path));
            }
            $cursor = dirname($cursor);
        }

        return $destination;
    }

    private function ensureDirectory(string $path): void
    {
        if (!is_dir($path) && !mkdir($path, 0775, true) && !is_dir($path)) {
            throw new PlatformUpdateException(sprintf('Rollback cannot create directory "%s".', $path));
        }
    }
}
