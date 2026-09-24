<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface ExtensionApiInterface
{
    /** @param callable(mixed, array<string, mixed>): mixed $callback */
    public function addFilter(string $name, callable $callback, int $priority = 10): void;

    /** @param callable(array<string, mixed>): void $callback */
    public function addAction(string $name, callable $callback, int $priority = 10): void;

    /** @param array<string, mixed> $context */
    public function applyFilters(string $name, mixed $value, array $context = []): mixed;

    /** @param array<string, mixed> $context */
    public function doAction(string $name, array $context = []): void;
}
