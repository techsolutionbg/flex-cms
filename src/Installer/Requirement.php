<?php

declare(strict_types=1);

namespace Flex\Installer;

final readonly class Requirement
{
    public function __construct(
        public string $label,
        public bool $passed,
        public string $detail,
    ) {}
}
