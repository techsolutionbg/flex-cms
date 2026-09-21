<?php

declare(strict_types=1);

namespace Flex\Installer\Contracts;

interface EnvironmentWriterInterface
{
    /** @param array<string, string> $values */
    public function write(array $values): void;

    public function remove(): void;
}
