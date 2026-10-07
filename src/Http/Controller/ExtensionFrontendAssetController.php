<?php

declare(strict_types=1);

namespace Flex\Http\Controller;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extensions\FrontendExtensionAssets;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class ExtensionFrontendAssetController
{
    public function __construct(
        private FrontendExtensionAssets $assets,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $id = isset($arguments['vendor'], $arguments['plugin']) ? $arguments['vendor'] . '/' . $arguments['plugin'] : (string) ($arguments['id'] ?? '');
        $asset = $this->assets->resolve($id, (string) ($arguments['asset'] ?? ''));
        if ($asset === null) {
            return $this->responses->text('Ресурсът не е намерен.', 404);
        }

        $contents = file_get_contents($asset['path']);
        if ($contents === false) {
            return $this->responses->text('Ресурсът не е намерен.', 404);
        }

        $mime = $asset['type'] === 'style' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
        $etag = '"' . hash('sha256', $contents) . '"';
        $headers = [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, no-cache',
            'ETag' => $etag,
            'X-Content-Type-Options' => 'nosniff',
        ];
        if ($request->getHeaderLine('If-None-Match') === $etag) {
            return $this->responses->text('', 304, $headers);
        }

        return $this->responses->text($contents, 200, $headers);
    }
}
