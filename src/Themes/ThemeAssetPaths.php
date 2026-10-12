<?php

declare(strict_types=1);

namespace Flex\Themes;

/** Resolves theme static files from legacy paths or theme src/assets (code-in-src layout). */
final class ThemeAssetPaths
{
    public static function resolveStylesheet(string $themeRoot): ?string
    {
        foreach (['style.css', 'src/assets/style.css'] as $relative) {
            $path = self::realFile($themeRoot, $relative);
            if ($path !== null) {
                return $path;
            }
        }

        return null;
    }

    public static function resolvePublicAsset(string $themeRoot, string $assetName): ?string
    {
        if ($assetName === 'style.css') {
            return self::resolveStylesheet($themeRoot);
        }
        foreach (['assets/' . $assetName, 'src/assets/' . $assetName] as $relative) {
            $path = self::realFile($themeRoot, $relative);
            if ($path !== null) {
                return $path;
            }
        }

        return null;
    }

    /** @return array{file: string, public_suffix: string}|null public_suffix is the path segment after /theme-assets/{theme}/ */
    public static function resolveScreenshot(string $themeRoot, string $manifestValue): ?array
    {
        $relative = trim($manifestValue);
        if ($relative === '' || preg_match('/^(?!.*\.\.)[a-zA-Z0-9][a-zA-Z0-9._\\/-]*$/', $relative) !== 1) {
            return null;
        }
        if (str_starts_with($relative, 'assets/')) {
            $relative = substr($relative, strlen('assets/'));
        }
        if (str_starts_with($relative, 'src/assets/')) {
            $candidates = [$relative];
        } else {
            $candidates = ['assets/' . $relative, 'src/assets/' . $relative];
        }
        foreach ($candidates as $candidate) {
            $path = self::realFile($themeRoot, $candidate);
            if ($path !== null) {
                return ['file' => $path, 'public_suffix' => str_starts_with($candidate, 'src/assets/')
                    ? substr($candidate, strlen('src/assets/'))
                    : (str_starts_with($candidate, 'assets/') ? substr($candidate, strlen('assets/')) : $candidate)];
            }
        }

        return null;
    }

    private static function realFile(string $themeRoot, string $relative): ?string
    {
        if ($relative === '' || str_contains($relative, '..')) {
            return null;
        }
        $root = realpath($themeRoot);
        if ($root === false) {
            return null;
        }
        $path = realpath($root . '/' . str_replace('\\', '/', $relative));
        if ($path === false || !is_file($path) || !str_starts_with(str_replace('\\', '/', $path), str_replace('\\', '/', $root) . '/')) {
            return null;
        }

        return $path;
    }
}
