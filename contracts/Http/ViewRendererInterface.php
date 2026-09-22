<?php

declare(strict_types=1);

namespace Flex\Contracts\Http;

interface ViewRendererInterface
{
    /** @param array<string, mixed> $data */
    public function render(string $template, array $data = []): string;
}
