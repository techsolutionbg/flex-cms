<?php

declare(strict_types=1);

namespace Flex\Contracts\Configuration;

interface ConfigRepositoryInterface
{
    public function has(string $key): bool;

    public function get(string $key, mixed $default = null): mixed;

    public function string(string $key, ?string $default = null): string;

    public function int(string $key, ?int $default = null): int;

    public function bool(string $key, ?bool $default = null): bool;

    /** @param array<mixed>|null $default
     *  @return array<mixed>
     */
    public function array(string $key, ?array $default = null): array;

    /** @return array<string, mixed> */
    public function all(): array;
}
