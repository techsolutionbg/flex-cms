<?php

declare(strict_types=1);

namespace Flex\Installer;

final readonly class DatabaseProbeResult
{
    public function __construct(
        public bool $connected,
        public ?string $serverVersion,
        public ?string $error = null,
    ) {}
}
