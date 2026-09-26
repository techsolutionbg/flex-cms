<?php

declare(strict_types=1);

namespace Flex\Updates\Jobs;

final readonly class UpdateJob
{
    /** @param array<string, mixed> $result */
    public function __construct(
        public string $id,
        public string $type,
        public string $status,
        public bool $dryRun,
        public string $createdAt,
        public ?string $startedAt = null,
        public ?string $finishedAt = null,
        public ?string $error = null,
        public array $result = [],
        public ?string $packageId = null,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return ['id' => $this->id, 'type' => $this->type, 'package_id' => $this->packageId, 'status' => $this->status, 'dry_run' => $this->dryRun, 'created_at' => $this->createdAt, 'started_at' => $this->startedAt, 'finished_at' => $this->finishedAt, 'error' => $this->error, 'result' => $this->result];
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self((string) ($data['id'] ?? ''), (string) ($data['type'] ?? ''), (string) ($data['status'] ?? ''), (bool) ($data['dry_run'] ?? false), (string) ($data['created_at'] ?? ''), is_string($data['started_at'] ?? null) ? $data['started_at'] : null, is_string($data['finished_at'] ?? null) ? $data['finished_at'] : null, is_string($data['error'] ?? null) ? $data['error'] : null, is_array($data['result'] ?? null) ? $data['result'] : [], is_string($data['package_id'] ?? null) ? $data['package_id'] : null);
    }
}
