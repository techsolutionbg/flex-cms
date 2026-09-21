<?php

declare(strict_types=1);

namespace Flex\Http\Middleware;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\Exception\InvalidRequestBody;
use Flex\Users\Exception\UserNotFound;
use Flex\Users\Exception\UserValidationFailed;
use League\Route\Http\Exception\HttpExceptionInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;

final readonly class ErrorHandlerMiddleware implements MiddlewareInterface
{
    public function __construct(
        private ResponseFactoryInterface $responses,
        private ConfigRepositoryInterface $configuration,
        private LoggerInterface $logger,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        try {
            return $handler->handle($request);
        } catch (\Throwable $exception) {
            $status = match (true) {
                $exception instanceof HttpExceptionInterface => $exception->getStatusCode(),
                $exception instanceof InvalidRequestBody => 400,
                $exception instanceof UserNotFound => 404,
                $exception instanceof UserValidationFailed => 422,
                default => 500,
            };
            $headers = $exception instanceof HttpExceptionInterface ? $exception->getHeaders() : [];
            $message = $status < 500 || $this->configuration->bool('app.debug')
                ? $exception->getMessage()
                : 'Internal Server Error';

            $this->logger->error('HTTP request failed.', [
                'exception' => $exception,
                'method' => $request->getMethod(),
                'uri' => (string) $request->getUri(),
                'request_id' => $request->getAttribute('request_id'),
                'status' => $status,
            ]);

            if ($this->expectsJson($request)) {
                return $this->responses->json([
                    'error' => [
                        'status' => $status,
                        'message' => $message,
                    ],
                ], $status, $headers);
            }

            $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

            return $this->responses->html(sprintf(
                '<!doctype html><html lang="en"><meta charset="utf-8"><title>%d</title><h1>%d</h1><p>%s</p>',
                $status,
                $status,
                $safeMessage,
            ), $status, $headers);
        }
    }

    private function expectsJson(ServerRequestInterface $request): bool
    {
        return str_starts_with($request->getUri()->getPath(), '/api/')
            || str_contains(strtolower($request->getHeaderLine('Accept')), 'application/json');
    }
}
