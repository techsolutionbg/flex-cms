<?php

declare(strict_types=1);

namespace Flex\Http\View;

final readonly class ViteAssetManager
{
    private const ENTRY = 'src/admin.tsx';

    public function __construct(private string $basePath) {}

    public function tags(): string
    {
        $devServer = rtrim((string) ($_ENV['VITE_DEV_SERVER_URL'] ?? ''), '/');
        if (($_ENV['APP_ENV'] ?? 'production') === 'local' && $devServer !== '') {
            $url = htmlspecialchars($devServer, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

            return sprintf(<<<'HTML'
            <script type="module">
                import RefreshRuntime from '%1$s/@react-refresh';
                RefreshRuntime.injectIntoGlobalHook(window);
                window.$RefreshReg$ = () => {};
                window.$RefreshSig$ = () => (type) => type;
                window.__vite_plugin_react_preamble_installed__ = true;
            </script>
            <script type="module" src="%1$s/@vite/client"></script>
            <script type="module" src="%1$s/src/admin.tsx"></script>
            HTML, $url);
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
