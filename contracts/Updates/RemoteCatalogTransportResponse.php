<?php

declare(strict_types=1);

namespace Flex\Contracts\Updates;

final readonly class RemoteCatalogTransportResponse
{
    /** @param array<string, string> $headers */
    public function __construct(
        public int $status,
        public string $body,
        public array $headers = [],
    ) {}
}
