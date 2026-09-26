<?php

declare(strict_types=1);

namespace Flex\Updates\Remote;

use Flex\Updates\Exception\PlatformUpdateException;

final readonly class PluginUpdateHistory
{
    public function __construct(private string $basePath) {}

    /** @param array<string, mixed> $record */
    public function append(array $record): void
    {
        $records = $this->all();
        $records[] = $record;
        $directory = dirname($this->path());
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) throw new PlatformUpdateException('The plugin update history directory cannot be created.');
        $temporary = $this->path() . '.tmp-' . bin2hex(random_bytes(5));
        if (file_put_contents($temporary, json_encode($records, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL, LOCK_EX) === false || !rename($temporary, $this->path())) {
            @unlink($temporary);
            throw new PlatformUpdateException('The plugin update history cannot be written.');
        }
    }

    /** @return list<array<string, mixed>> */
    public function all(): array
    {
        if (!is_file($this->path())) return [];
        try { $data = json_decode((string) file_get_contents($this->path()), true, 512, JSON_THROW_ON_ERROR); } catch (\JsonException $exception) { throw new PlatformUpdateException('The plugin update history contains invalid JSON.', 0, $exception); }
        if (!is_array($data)) throw new PlatformUpdateException('The plugin update history must be an array.');

        return array_values(array_filter($data, 'is_array'));
    }

    /** @return array<string, mixed> */
    public function find(string $id): array
    {
        foreach ($this->all() as $record) if (($record['id'] ?? null) === $id) return $record;
        throw new PlatformUpdateException(sprintf('Plugin update history record "%s" was not found.', $id));
    }

    private function path(): string { return $this->basePath . '/storage/updates/plugins-history.json'; }
}
