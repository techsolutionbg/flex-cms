<?php

declare(strict_types=1);

namespace Flex\Database;

final readonly class DatabaseStatus
{
    public function __construct(
        public bool $connected,
        public string $connection,
        public string $database,
        public ?string $serverVersion,
        public float $latencyMilliseconds,
        public ?string $error = null,
    ) {}
}
