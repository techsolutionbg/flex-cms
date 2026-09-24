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
        $asset = $this->assets->resolve((string) ($arguments['id'] ?? ''), (string) ($arguments['asset'] ?? ''));
        if ($asset === null) {
            return $this->responses->text('Not found', 404);
        }

        $contents = file_get_contents($asset['path']);
        if ($contents === false) {
            return $this->responses->text('Not found', 404);
        }

        $mime = $asset['type'] === 'style' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';

        return $this->responses->text($contents, 200, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
