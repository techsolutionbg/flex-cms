<?php

declare(strict_types=1);

namespace Flex\Tests\Http\Middleware;

use Flex\Configuration\ConfigurationRepository;
use Flex\Configuration\ProjectPaths;
use Flex\Http\Middleware\MaintenanceModeMiddleware;
use Flex\Http\ResponseFactory;
use Nyholm\Psr7\Factory\Psr17Factory;
use Nyholm\Psr7\Response;
use Nyholm\Psr7\ServerRequest;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

final class MaintenanceModeMiddlewareTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/flex-maintenance-' . bin2hex(random_bytes(6));
        mkdir($this->directory . '/storage', 0775, true);
        file_put_contents($this->directory . '/storage/maintenance.json', '{}');
    }

    protected function tearDown(): void
    {
        @unlink($this->directory . '/storage/maintenance.json');
        @rmdir($this->directory . '/storage');
        @rmdir($this->directory);
    }

    public function testItBlocksSiteRequestsButAllowsHealthChecks(): void
    {
        $configuration = new ConfigurationRepository(['paths' => ['storage' => 'storage']]);
        $middleware = new MaintenanceModeMiddleware(
            new ProjectPaths($this->directory, $configuration),
            new ResponseFactory(new Psr17Factory()),
        );
        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return new Response(200, [], 'available');
            }
        };

        $maintenance = $middleware->process(
            (new ServerRequest('GET', 'https://example.test/'))->withHeader('Accept', 'application/json'),
            $handler,
        );
        $health = $middleware->process(new ServerRequest('GET', 'https://example.test/health'), $handler);

        self::assertSame(503, $maintenance->getStatusCode());
        self::assertSame('60', $maintenance->getHeaderLine('Retry-After'));
        self::assertSame(200, $health->getStatusCode());
        self::assertSame('available', (string) $health->getBody());
    }
}
