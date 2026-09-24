<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface ContentBlockRegistrarInterface
{
    /** @param callable(array<string, mixed>): array<string, mixed> $normalizer */
    public function register(string $type, callable $normalizer): void;
}
