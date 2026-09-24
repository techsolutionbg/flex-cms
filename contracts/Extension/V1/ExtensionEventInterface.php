<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface ExtensionEventInterface
{
    public function name(): string;

    /** @return array<string, mixed> */
    public function payload(): array;
}
