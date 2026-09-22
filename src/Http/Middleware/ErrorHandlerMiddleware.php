<?php

declare(strict_types=1);

namespace Flex\Http\Middleware;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\ApiError;
use Flex\Http\Exception\InvalidRequestBody;
use Flex\Http\RequestFormat;
use Flex\Http\View\ViteAssetManager;
use Flex\Pages\Exception\PageNotFound;
use Flex\Pages\Exception\PageValidationFailed;
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
        private ViewRendererInterface $views,
        private ViteAssetManager $assets,
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
                $exception instanceof PageNotFound => 404,
                $exception instanceof PageValidationFailed => 422,
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

            if (RequestFormat::expectsJson($request)) {
                $code = match ($status) {
                    400 => 'invalid_request',
                    401 => 'authentication_required',
                    403 => 'forbidden',
                    404 => 'not_found',
                    422 => 'validation_failed',
                    429 => 'too_many_requests',
                    default => 'internal_error',
                };
                $details = match (true) {
                    $exception instanceof UserValidationFailed => ['fields' => $exception->errors],
                    $exception instanceof PageValidationFailed => ['fields' => $exception->errors],
                    default => [],
                };

                return $this->responses->json(ApiError::payload($status, $code, $message, $details), $status, $headers);
            }

            return $this->responses->html($this->views->render('system/error.twig', [
                'status' => $status,
                'message' => $message,
                'vite_tags' => $this->assets->tags(),
            ]), $status, $headers);
        }
    }

}
