<?php

declare(strict_types=1);

namespace Flex\Http\View;

final readonly class ViteAssetManager
{
    private const ENTRY = 'src/admin.ts';

    public function __construct(private string $basePath) {}

    public function tags(): string
    {
        $environment = (string) ($_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? getenv('APP_ENV') ?: 'production');
        $devServer = rtrim((string) ($_ENV['VITE_DEV_SERVER_URL'] ?? $_SERVER['VITE_DEV_SERVER_URL'] ?? getenv('VITE_DEV_SERVER_URL') ?: 'http://localhost:5173'), '/');
        if ($environment === 'local') {
            if ($devServer === '') {
                throw new \RuntimeException('Vite development server URL is required in local environment.');
            }

            $url = htmlspecialchars($devServer, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

            return sprintf(
                '<script type="module" src="%1$s/@vite/client"></script>\n<script type="module" src="%1$s/src/admin.ts"></script>',
                $url,
            );
        }

        $manifestPath = $this->basePath . '/public/build/admin/.vite/manifest.json';
        $manifest = is_file($manifestPath) ? json_decode((string) file_get_contents($manifestPath), true) : null;
        $entry = is_array($manifest) ? ($manifest[self::ENTRY] ?? null) : null;
        if (!is_array($entry) || !isset($entry['file'])) {
            throw new \RuntimeException('Admin Vite manifest entry is missing. Run the frontend build.');
        }

        $tags = [];
        foreach (($entry['css'] ?? []) as $css) {
            $tags[] = sprintf('<link rel="stylesheet" href="/build/admin/%s">', $this->asset((string) $css));
        }
        $tags[] = sprintf('<script type="module" src="/build/admin/%s"></script>', $this->asset((string) $entry['file']));

        return implode("\n", $tags);
    }

    private function asset(string $file): string
    {
        return htmlspecialchars(ltrim($file, '/'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
