<?php

declare(strict_types=1);

namespace Flex\Contracts\Http;

use Psr\Http\Message\ResponseInterface;

interface ResponseFactoryInterface
{
    /**
     * @param array<string, mixed> $payload
     * @param array<string, string|list<string>> $headers
     */
    public function json(array $payload, int $status = 200, array $headers = []): ResponseInterface;

    /** @param array<string, string|list<string>> $headers */
    public function html(string $html, int $status = 200, array $headers = []): ResponseInterface;

    /** @param array<string, string|list<string>> $headers */
    public function text(string $text, int $status = 200, array $headers = []): ResponseInterface;
}
