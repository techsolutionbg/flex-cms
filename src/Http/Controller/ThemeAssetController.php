<?php

declare(strict_types=1);

namespace Flex\Http\Controller;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\AssetVersion;
use Flex\Themes\ThemeAssetPaths;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class ThemeAssetController
{
    public function __construct(private ProjectPaths $paths, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $theme = (string) ($arguments['theme'] ?? '');
        $asset = (string) ($arguments['asset'] ?? 'style.css');
        if (preg_match('/^[a-z0-9][a-z0-9._-]*$/', $theme) !== 1 || $asset === '' || str_contains($asset, '..') || str_starts_with($asset, '/')) {
            return $this->responses->text('Ресурсът не е намерен.', 404);
        }

        $assetName = ltrim($asset, '/');
        $extension = strtolower(pathinfo($assetName, PATHINFO_EXTENSION));
        $allowed = ['css', 'js', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'woff', 'woff2', 'ttf', 'otf', 'ico', 'map'];
        $themeRoot = $this->paths->themes($theme);
        $path = ThemeAssetPaths::resolvePublicAsset($themeRoot, $assetName);
        if ($extension === '' || !in_array($extension, $allowed, true) || $path === null) {
            return $this->responses->text('Ресурсът не е намерен.', 404);
        }

        $mime = match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'css' => 'text/css; charset=utf-8',
            'js' => 'application/javascript; charset=utf-8',
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };

        // theme_asset() links files with ?v= of their current version; such a URL is kept for good.
        $cache = AssetVersion::matches($path, $request->getQueryParams()['v'] ?? null) ? AssetVersion::IMMUTABLE : 'public, max-age=3600';

        return $this->responses->text((string) file_get_contents($path), 200, ['Content-Type' => $mime, 'Cache-Control' => $cache]);
    }
}
