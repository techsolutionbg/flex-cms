<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Updates\Exception\PlatformUpdateException;

final readonly class PlatformHistory
{
    public function __construct(private string $basePath) {}

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        $path = $this->basePath . '/storage/updates/history.jsonl';
        if (!is_file($path)) {
            return [];
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            throw new PlatformUpdateException('The platform update history cannot be read.');
        }

        $history = [];
        foreach ($lines as $line) {
            try {
                $record = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException $exception) {
                throw new PlatformUpdateException('The platform update history contains invalid JSON.', 0, $exception);
            }
            if (!is_array($record)) {
                throw new PlatformUpdateException('The platform update history contains an invalid record.');
            }
            $history[] = $record;
        }

        return $history;
    }

    /** @return array<string, mixed> */
    public function find(string $id): array
    {
        foreach (array_reverse($this->all()) as $record) {
            if (($record['id'] ?? null) === $id && ($record['type'] ?? null) === 'platform') {
                return $record;
            }
        }

        throw new PlatformUpdateException(sprintf('Platform update "%s" was not found in history.', $id));
    }
}
