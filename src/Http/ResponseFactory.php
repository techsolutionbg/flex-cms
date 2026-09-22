<?php

declare(strict_types=1);

namespace Flex\Http;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Psr\Http\Message\ResponseFactoryInterface as PsrResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;

final readonly class ResponseFactory implements ResponseFactoryInterface
{
    public function __construct(
        private PsrResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string|list<string>> $headers */
    public function json(array $payload, int $status = 200, array $headers = []): ResponseInterface
    {
        $json = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return $this->create($json, $status, ['Content-Type' => 'application/json; charset=utf-8'] + $headers);
    }

    /** @param array<string, string|list<string>> $headers */
    public function html(string $html, int $status = 200, array $headers = []): ResponseInterface
    {
        $defaults = ['Content-Type' => 'text/html; charset=utf-8'];
        if (($_ENV['APP_ENV'] ?? 'production') === 'local') {
            $defaults['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
            $defaults['Pragma'] = 'no-cache';
        }

        return $this->create($html, $status, $defaults + $headers);
    }

    /** @param array<string, string|list<string>> $headers */
    public function text(string $text, int $status = 200, array $headers = []): ResponseInterface
    {
        return $this->create($text, $status, ['Content-Type' => 'text/plain; charset=utf-8'] + $headers);
    }

    /** @param array<string, string|list<string>> $headers */
    private function create(string $body, int $status, array $headers): ResponseInterface
    {
        $response = $this->responses->createResponse($status);
        $response->getBody()->write($body);

        foreach ($headers as $name => $values) {
            $response = $response->withHeader($name, $values);
        }

        return $response;
    }
}
