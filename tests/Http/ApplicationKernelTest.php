<?php

declare(strict_types=1);

namespace Flex\Tests\Http;

use Flex\Bootstrap;
use Flex\Contracts\Http\KernelInterface;
use Nyholm\Psr7\ServerRequest;
use PHPUnit\Framework\TestCase;

final class ApplicationKernelTest extends TestCase
{
    private KernelInterface $kernel;

    protected function setUp(): void
    {
        $this->kernel = Bootstrap::boot(dirname(__DIR__, 2))->container()->get(KernelInterface::class);
    }

    public function testItDispatchesCoreRoutesThroughTheMiddlewarePipeline(): void
    {
        $response = $this->kernel->handle(new ServerRequest('GET', 'http://localhost/health'));
        $payload = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('ok', $payload['status']);
        self::assertSame('nosniff', $response->getHeaderLine('X-Content-Type-Options'));
        self::assertMatchesRegularExpression('/^[a-f0-9]{32}$/', $response->getHeaderLine('X-Request-ID'));
    }

    public function testItReturnsJson404And405Responses(): void
    {
        $notFound = $this->kernel->handle(
            (new ServerRequest('GET', 'http://localhost/missing'))->withHeader('Accept', 'application/json'),
        );
        $methodNotAllowed = $this->kernel->handle(
            (new ServerRequest('POST', 'http://localhost/health'))->withHeader('Accept', 'application/json'),
        );

        self::assertSame(404, $notFound->getStatusCode());
        self::assertSame(404, json_decode((string) $notFound->getBody(), true)['error']['status']);
        self::assertSame('SAMEORIGIN', $notFound->getHeaderLine('X-Frame-Options'));
        self::assertSame(405, $methodNotAllowed->getStatusCode());
        self::assertStringContainsString('GET', $methodNotAllowed->getHeaderLine('Allow'));
    }

    public function testItRedirectsUnauthenticatedVisitorsAwayFromTheAdminPanel(): void
    {
        $response = $this->kernel->handle(new ServerRequest('GET', 'http://localhost/admin'));

        self::assertSame(302, $response->getStatusCode());
        self::assertSame('/login', $response->getHeaderLine('Location'));
    }

    public function testItRedirectsUnauthenticatedVisitorsAwayFromTheUpdatesPanel(): void
    {
        $response = $this->kernel->handle(new ServerRequest('GET', 'http://localhost/admin/updates'));

        self::assertSame(302, $response->getStatusCode());
        self::assertSame('/login', $response->getHeaderLine('Location'));
    }

    public function testItRejectsUntrustedHostsBeforeRouting(): void
    {
        $response = $this->kernel->handle(new ServerRequest('GET', 'http://malicious.example/health'));

        self::assertSame(400, $response->getStatusCode());
        self::assertSame('Bad Request', (string) $response->getBody());
    }
}
