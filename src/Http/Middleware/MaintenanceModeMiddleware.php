<?php

declare(strict_types=1);

namespace Flex\Http\Middleware;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

final readonly class MaintenanceModeMiddleware implements MiddlewareInterface
{
    public function __construct(
        private ProjectPaths $paths,
        private ResponseFactoryInterface $responses,
        private ViewRendererInterface $views,
        private ViteAssetManager $assets,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        // Only the authenticated read-only job monitor remains available during replacement.
        $monitor = $request->getMethod() === 'GET'
            && $request->getUri()->getPath() === '/api/admin/updates'
            && is_string($request->getQueryParams()['job_id'] ?? null)
            && ($request->getQueryParams()['job_id'] ?? '') !== '';
        if ($monitor || $request->getUri()->getPath() === '/health' || !is_file($this->paths->storage('maintenance.json'))) {
            return $handler->handle($request);
        }

        if ($this->expectsJson($request)) {
            return $this->responses->json(['status' => 'maintenance'], 503, ['Retry-After' => '60']);
        }

        return $this->responses->html($this->views->render('system/maintenance.twig', [
            'vite_tags' => $this->assets->tags(),
        ]), 503, ['Retry-After' => '60']);
    }

    private function expectsJson(ServerRequestInterface $request): bool
    {
        return str_starts_with($request->getUri()->getPath(), '/api/')
            || str_contains(strtolower($request->getHeaderLine('Accept')), 'application/json');
    }
}
