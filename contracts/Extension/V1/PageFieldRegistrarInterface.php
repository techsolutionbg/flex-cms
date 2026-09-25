<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface PageFieldRegistrarInterface
{
    public function text(string $id, string $label, string $default = '', string $hint = '', int $maxLength = 190, int $priority = 50): void;

    public function textarea(string $id, string $label, string $default = '', string $hint = '', int $maxLength = 1000, int $priority = 50): void;

    public function checkbox(string $id, string $label, bool $default = false, string $hint = '', int $priority = 50): void;

    /** @param callable(int): array<string, string|bool> $resolver */
    public function values(callable $resolver): void;
}
