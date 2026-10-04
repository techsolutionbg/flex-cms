<?php

declare(strict_types=1);

namespace Flex\Http\View;

use Flex\Extensions\FrontendExtensionAssets;
use Flex\Http\SitePath;

final readonly class ViteAssetManager
{
    private const ENTRY = 'index.html';

    public function __construct(
        private string $basePath,
        private ?FrontendExtensionAssets $extensions = null,
    ) {}

    public function tags(): string
    {
        $manifestPath = $this->basePath . '/public/build/react-admin/.vite/manifest.json';
        $manifest = is_file($manifestPath) ? json_decode((string) file_get_contents($manifestPath), true) : null;
        $entry = is_array($manifest) ? ($manifest[self::ENTRY] ?? null) : null;
        if (!is_array($entry)) {
            return $this->extensions?->tags() ?? '';
        }

        $tags = [];
        foreach (($entry['css'] ?? []) as $css) {
            $tags[] = sprintf('<link rel="stylesheet" href="%s/build/react-admin/%s">', htmlspecialchars(SitePath::prefix(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), $this->asset((string) $css));
        }
        return implode("\n", $tags) . "\n" . ($this->extensions?->tags() ?? '');
    }

    /** Return compiled styles for server-rendered pages such as the installer. */
    public function styles(): string
    {
        $manifestPath = $this->basePath . '/public/build/react-admin/.vite/manifest.json';
        $manifest = is_file($manifestPath) ? json_decode((string) file_get_contents($manifestPath), true) : null;
        $entry = is_array($manifest) ? ($manifest[self::ENTRY] ?? null) : null;
        if (!is_array($entry)) {
            return '';
        }

        $tags = [];
        foreach (($entry['css'] ?? []) as $css) {
            $tags[] = sprintf('<link rel="stylesheet" href="%s/build/react-admin/%s">', htmlspecialchars(SitePath::prefix(), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), $this->asset((string) $css));
        }

        return implode("\n", $tags);
    }

    public function installerTags(): string
    {
        $manifestPath = $this->basePath . '/public/build/installer/.vite/manifest.json';
        $manifest = is_file($manifestPath) ? json_decode((string) file_get_contents($manifestPath), true) : null;
        $entry = is_array($manifest) ? ($manifest['installer.html'] ?? null) : null;
        if (!is_array($entry) || !isset($entry['file'])) {
            return '';
        }

        $assetBase = SitePath::prefix() . '/build/installer/';
        $tags = [];
        foreach (($entry['css'] ?? []) as $css) {
            $tags[] = sprintf('<link rel="stylesheet" href="%s%s">', $assetBase, $this->asset((string) $css));
        }
        $tags[] = sprintf('<script type="module" src="%s%s"></script>', $assetBase, $this->asset((string) $entry['file']));

        return implode("\n", $tags);
    }

    private function asset(string $file): string
    {
        return htmlspecialchars(ltrim($file, '/'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
