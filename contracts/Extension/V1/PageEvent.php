<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

final readonly class PageEvent implements ExtensionEventInterface
{
    /** @param array<string, mixed> $page */
    public function __construct(
        private string $eventName,
        public array $page,
    ) {}

    public function name(): string
    {
        return $this->eventName;
    }

    public function payload(): array
    {
        return ['page' => $this->page];
    }
}
