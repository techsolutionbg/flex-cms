<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Updates\Exception\PlatformUpdateException;

final readonly class PlatformUpdateState
{
    /** @param list<string> $affectedPaths */
    public function __construct(
        public string $id,
        public string $phase,
        public string $from,
        public string $to,
        public string $checksum,
        public string $backupPath,
        public string $workPath,
        public ?string $databaseBackupPath,
        public array $affectedPaths,
        public string $startedAt,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $required = ['id', 'phase', 'from', 'to', 'checksum', 'backup_path', 'work_path', 'database_backup_path', 'affected_paths', 'started_at'];
        foreach ($required as $key) {
            if (!array_key_exists($key, $data)) {
                throw new PlatformUpdateException(sprintf('The platform update state is missing "%s".', $key));
            }
        }

        if (!is_string($data['id']) || !is_string($data['phase']) || !is_string($data['from'])
            || !is_string($data['to']) || !is_string($data['checksum']) || !is_string($data['backup_path'])
            || !is_string($data['work_path']) || ($data['database_backup_path'] !== null && !is_string($data['database_backup_path']))
            || !is_string($data['started_at']) || !is_array($data['affected_paths'])) {
            throw new PlatformUpdateException('The platform update state is invalid.');
        }

        $paths = [];
        foreach ($data['affected_paths'] as $path) {
            if (!is_string($path) || $path === '') {
                throw new PlatformUpdateException('The platform update state contains an invalid path.');
            }
            $paths[] = $path;
        }

        return new self(
            id: $data['id'],
            phase: $data['phase'],
            from: $data['from'],
            to: $data['to'],
            checksum: $data['checksum'],
            backupPath: $data['backup_path'],
            workPath: $data['work_path'],
            databaseBackupPath: $data['database_backup_path'],
            affectedPaths: $paths,
            startedAt: $data['started_at'],
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'phase' => $this->phase,
            'from' => $this->from,
            'to' => $this->to,
            'checksum' => $this->checksum,
            'backup_path' => $this->backupPath,
            'work_path' => $this->workPath,
            'database_backup_path' => $this->databaseBackupPath,
            'affected_paths' => $this->affectedPaths,
            'started_at' => $this->startedAt,
        ];
    }
}
