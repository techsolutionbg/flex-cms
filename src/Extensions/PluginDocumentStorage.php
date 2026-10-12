<?php

declare(strict_types=1);

namespace Flex\Extensions;

use Flex\Extension\V1\PluginStorageInterface;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;

final readonly class PluginDocumentStorage implements PluginStorageInterface
{
    public function __construct(private Connection $database, private string $pluginId) {}

    public function get(string $key): ?array
    {
        $value = $this->query()->where('document_key', $key)->value('payload');
        if (!is_string($value)) {
            return null;
        }
        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($value, true, 64, JSON_THROW_ON_ERROR);
        return $decoded;
    }

    public function put(string $key, array $value): void
    {
        if ($key === '_lock' || preg_match('/^[a-zA-Z0-9._:\/-]{1,190}$/D', $key) !== 1) {
            throw new \InvalidArgumentException('Invalid document key.');
        }
        $this->query()->updateOrInsert(['plugin_id' => $this->pluginId, 'document_key' => $key], ['payload' => json_encode($value, JSON_THROW_ON_ERROR), 'updated_at' => gmdate('Y-m-d H:i:s')]);
    }

    public function delete(string $key): void
    {
        if ($key === '_lock') {
            throw new \InvalidArgumentException('Reserved document key.');
        }
        $this->query()->where('document_key', $key)->delete();
    }

    public function list(string $prefix, int $limit = 100, int $offset = 0): array
    {
        if (preg_match('/^[a-zA-Z0-9.:\/-]+$/D', $prefix) !== 1) {
            throw new \InvalidArgumentException('Invalid prefix.');
        }
        $result = [];
        foreach ($this->query()->where('document_key', 'like', $prefix . '%')->orderBy('document_key')->limit(max(1, min(500, $limit)))->offset(max(0, $offset))->get() as $row) {
            /** @var array<string, mixed> $payload */
            $payload = json_decode((string) $row->payload, true, 64, JSON_THROW_ON_ERROR);
            $result[(string) $row->document_key] = $payload;
        }
        return $result;
    }

    public function transaction(callable $callback): mixed
    {
        // Insert-once mutex makes new-key writes and idempotency checks atomic too.
        $this->query()->insertOrIgnore(['plugin_id' => $this->pluginId, 'document_key' => '_lock', 'payload' => '{}', 'updated_at' => gmdate('Y-m-d H:i:s')]);
        return $this->database->transaction(function () use ($callback): mixed {
            $this->query()->where('document_key', '_lock')->lockForUpdate()->first();
            return $callback();
        }, 3);
    }

    private function query(): Builder
    {
        return $this->database->table('extension_documents')->where('plugin_id', $this->pluginId);
    }
}
