<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

/** JSON documents isolated by plugin ID and the current site's database. */
interface PluginStorageInterface
{
    /** @return array<string, mixed>|null */
    public function get(string $key): ?array;

    /** @param array<string, mixed> $value */
    public function put(string $key, array $value): void;

    public function delete(string $key): void;

    /** @return array<string, array<string, mixed>> */
    public function list(string $prefix, int $limit = 100, int $offset = 0): array;

    /**
     * Serializes callbacks within this plugin, including concurrent requests.
     * @template T
     * @param callable(): T $callback
     * @return T
     */
    public function transaction(callable $callback): mixed;
}
