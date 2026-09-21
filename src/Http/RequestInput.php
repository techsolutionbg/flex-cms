<?php

declare(strict_types=1);

namespace Flex\Http;

use Flex\Http\Exception\InvalidRequestBody;
use Psr\Http\Message\ServerRequestInterface;

final class RequestInput
{
    /** @return array<string, mixed> */
    public function all(ServerRequestInterface $request): array
    {
        $parsed = $request->getParsedBody();
        if (is_array($parsed)) {
            return $parsed;
        }

        $contentType = strtolower($request->getHeaderLine('Content-Type'));
        if (!str_contains($contentType, 'application/json')) {
            return [];
        }

        try {
            $decoded = json_decode((string) $request->getBody(), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new InvalidRequestBody('Request body contains invalid JSON.', 0, $exception);
        }
        if (!is_array($decoded)) {
            throw new InvalidRequestBody('JSON request body must be an object.');
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }
}
