<?php

declare(strict_types=1);

namespace Flex\Http;

use Psr\Http\Message\ServerRequestInterface;

final class RequestFormat
{
    public static function expectsJson(ServerRequestInterface $request): bool
    {
        return str_starts_with($request->getUri()->getPath(), '/api/')
            || str_contains(strtolower($request->getHeaderLine('Accept')), 'application/json');
    }
}
