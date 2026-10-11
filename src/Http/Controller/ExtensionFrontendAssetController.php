<?php

declare(strict_types=1);

namespace Flex\Http\Controller;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extensions\FrontendExtensionAssets;
use Flex\Http\AssetVersion;
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

        if ($asset['type'] === 'script') {
            $contents = self::versionImports($contents, dirname($asset['path']));
        }
        $mime = $asset['type'] === 'style' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
        $etag = '"' . hash('sha256', $contents) . '"';
        // Pages link assets with ?v= of the file's current version. Such a URL never changes content, so the
        // browser keeps it without asking again; any other URL is checked on every use.
        $immutable = AssetVersion::matches($asset['path'], $request->getQueryParams()['v'] ?? null);
        $headers = [
            'Content-Type' => $mime,
            'Cache-Control' => $immutable ? AssetVersion::IMMUTABLE : 'public, no-cache',
            'ETag' => $etag,
            'X-Content-Type-Options' => 'nosniff',
        ];
        if ($request->getHeaderLine('If-None-Match') === $etag) {
            return $this->responses->text('', 304, $headers);
        }

        return $this->responses->text($contents, 200, $headers);
    }

    /**
     * Gives relative imports of a module (./cart.js, ../x.js?v=3) the current version of the imported file, the
     * same as in the page's script tags. The browser then loads each module once, under one URL it may cache.
     */
    public static function versionImports(string $source, string $directory): string
    {
        return (string) preg_replace_callback(
            AssetVersion::IMPORTS,
            static function (array $match) use ($directory): string {
                $version = AssetVersion::ofModule($directory . '/' . $match[3]);

                return $version === null ? $match[0] : $match[1] . $match[2] . $match[3] . '?v=' . $version . $match[2];
            },
            $source,
        );
    }
}
