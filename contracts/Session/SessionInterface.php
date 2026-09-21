<?php

declare(strict_types=1);

namespace Flex\Contracts\Session;

interface SessionInterface
{
    public function start(): void;

    public function has(string $key): bool;

    public function get(string $key, mixed $default = null): mixed;

    public function put(string $key, mixed $value): void;

    public function remove(string $key): void;

    public function regenerate(): void;

    public function invalidate(): void;
}
