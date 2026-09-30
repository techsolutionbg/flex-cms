<?php

declare(strict_types=1);

namespace Flex\Session;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\ApiError;
use Flex\Http\RequestFormat;
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
            if (RequestFormat::expectsJson($request)) {
                return $this->responses->json(ApiError::payload(403, 'csrf_token_mismatch', 'Сигурността на заявката не може да бъде потвърдена.'), 403);
            }

            return $this->responses->text('Невалиден токен за сигурност. Презаредете страницата и опитайте отново.', 403);
        }

        return $handler->handle($request);
    }

}
