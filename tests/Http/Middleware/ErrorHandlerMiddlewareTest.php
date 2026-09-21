<?php

declare(strict_types=1);

namespace Flex\Tests\Http\Middleware;

use Flex\Configuration\ConfigurationRepository;
use Flex\Http\Middleware\ErrorHandlerMiddleware;
use Flex\Http\ResponseFactory;
use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7\ServerRequest;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\NullLogger;

final class ErrorHandlerMiddlewareTest extends TestCase
{
    public function testItHidesInternalExceptionDetailsOutsideDebugMode(): void
    {
        $middleware = new ErrorHandlerMiddleware(
            new ResponseFactory(new Psr17Factory()),
            new ConfigurationRepository(['app' => ['debug' => false]]),
            new NullLogger(),
        );
        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                throw new \RuntimeException('Sensitive internal detail');
            }
        };

        $response = $middleware->process(
            (new ServerRequest('GET', 'https://example.test/api/failure'))->withHeader('Accept', 'application/json'),
            $handler,
        );

        self::assertSame(500, $response->getStatusCode());
        self::assertStringContainsString('Internal Server Error', (string) $response->getBody());
        self::assertStringNotContainsString('Sensitive internal detail', (string) $response->getBody());
    }
}
