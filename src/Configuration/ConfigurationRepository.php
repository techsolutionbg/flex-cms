<?php

declare(strict_types=1);

namespace Flex\Configuration;

use Flex\Configuration\Exception\ConfigurationKeyNotFound;
use Flex\Configuration\Exception\InvalidConfigurationValue;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;

final readonly class ConfigurationRepository implements ConfigRepositoryInterface
{
    /** @param array<string, mixed> $values */
    public function __construct(
        private array $values,
    ) {
    }

    public function has(string $key): bool
    {
        return $this->resolve($key, false)[0];
    }

    public function get(string $key, mixed $default = null): mixed
    {
        [$found, $value] = $this->resolve($key, false);

        return $found ? $value : $default;
    }

    public function string(string $key, ?string $default = null): string
    {
        return $this->typed($key, 'string', $default);
    }

    public function int(string $key, ?int $default = null): int
    {
        return $this->typed($key, 'integer', $default);
    }

    public function bool(string $key, ?bool $default = null): bool
    {
        return $this->typed($key, 'boolean', $default);
    }

    /** @param array<mixed>|null $default
     *  @return array<mixed>
     */
    public function array(string $key, ?array $default = null): array
    {
        return $this->typed($key, 'array', $default);
    }

    public function all(): array
    {
        return $this->values;
    }

    /** @return array{bool, mixed} */
    private function resolve(string $key, bool $throwWhenMissing): array
    {
        if ($key === '') {
            throw new ConfigurationKeyNotFound('Configuration keys cannot be empty.');
        }

        $value = $this->values;
        foreach (explode('.', $key) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                if ($throwWhenMissing) {
                    throw new ConfigurationKeyNotFound(sprintf('Configuration key "%s" does not exist.', $key));
                }

                return [false, null];
            }
            $value = $value[$segment];
        }

        return [true, $value];
    }

    private function typed(string $key, string $type, mixed $default): mixed
    {
        [$found, $value] = $this->resolve($key, false);
        if (!$found) {
            if ($default !== null) {
                return $default;
            }

            throw new ConfigurationKeyNotFound(sprintf('Configuration key "%s" does not exist.', $key));
        }

        if (gettype($value) !== $type) {
            throw new InvalidConfigurationValue(sprintf(
                'Configuration key "%s" must be %s; %s given.',
                $key,
                $type,
                get_debug_type($value),
            ));
        }

        return $value;
    }
}
