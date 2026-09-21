<?php

declare(strict_types=1);

namespace Flex\Session;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class CsrfMiddleware implements MiddlewareInterface
{
    private const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

    public function __construct(
        private CsrfTokenManager $tokens,
        private ResponseFactoryInterface $responses,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (in_array(strtoupper($request->getMethod()), self::SAFE_METHODS, true)) {
            return $handler->handle($request);
        }

        $token = $request->getHeaderLine('X-CSRF-Token');
        $body = $request->getParsedBody();
        if ($token === '' && is_array($body) && is_string($body['_token'] ?? null)) {
            $token = $body['_token'];
        }

        if (!$this->tokens->validate($token)) {
            if ($this->expectsJson($request)) {
                return $this->responses->json(['error' => ['status' => 403, 'message' => 'CSRF token mismatch.']], 403);
            }

            return $this->responses->html('<!doctype html><html lang="en"><meta charset="utf-8"><title>Forbidden</title><h1>Invalid security token</h1><p>Reload the page and try again.</p>', 403);
        }

        return $handler->handle($request);
    }

    private function expectsJson(ServerRequestInterface $request): bool
    {
        return str_starts_with($request->getUri()->getPath(), '/api/')
            || str_contains(strtolower($request->getHeaderLine('Accept')), 'application/json');
    }
}
