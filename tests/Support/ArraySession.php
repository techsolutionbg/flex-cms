<?php

declare(strict_types=1);

namespace Flex\Tests\Support;

use Flex\Contracts\Session\SessionInterface;

final class ArraySession implements SessionInterface
{
    /** @var array<string, mixed> */
    public array $values = [];
    public int $regenerations = 0;
    public bool $invalidated = false;

    public function start(): void {}

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->values);
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->values[$key] ?? $default;
    }

    public function put(string $key, mixed $value): void
    {
        $this->values[$key] = $value;
    }

    public function remove(string $key): void
    {
        unset($this->values[$key]);
    }

    public function regenerate(): void
    {
        ++$this->regenerations;
    }

    public function invalidate(): void
    {
        $this->values = [];
        $this->invalidated = true;
    }
}
