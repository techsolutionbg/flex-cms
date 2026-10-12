<?php

declare(strict_types=1);

namespace Flex\Themes;

/**
 * Maps platform render calls to on-disk theme PHP entry files.
 *
 * Flow: {@see ThemeManager::renderForTheme()} receives a logical template name
 * (`page.twig`, `404.twig`), derives {@see logicalViewFromTemplate()}, then
 * {@see resolveThemeEntryPath()}. When `src/index.php` exists, the same file
 * runs for every view; the platform sets `theme_view` before `include`.
 *
 * A theme may name its own start file with `"entry"` in `theme.json`
 * (e.g. `"entry": "src/main.php"`). It then runs for every view and replaces
 * the default lookup; without it the default lookup below applies unchanged.
 */
final class ThemeRenderPaths
{
    public const VIEW_PAGE = 'page';

    public const VIEW_NOT_FOUND = '404';

    /** @return list<string> */
    public static function unifiedPhpEntries(): array
    {
        return ['src/index.php', 'index.php'];
    }

    /** e.g. `page.twig` → `page` (becomes `theme_view` in the entry scope). */
    public static function logicalViewFromTemplate(string $templateFilename): string
    {
        return pathinfo($templateFilename, PATHINFO_FILENAME);
    }

    /** Relative `.php` path inside the theme, forward slashes, no `.`/`..` segments. */
    public static function isValidEntryPath(string $relative): bool
    {
        return strlen($relative) <= 255
            && preg_match('~^(?!.*(?:^|/)\.{1,2}(?:/|$))[A-Za-z0-9_][A-Za-z0-9._-]*(?:/[A-Za-z0-9_][A-Za-z0-9._-]*)*\.php$~', $relative) === 1;
    }

    /** The `entry` from the theme's `theme.json`, or null when it is not set or the manifest cannot be read. */
    public static function declaredEntry(string $themeRoot): ?string
    {
        $manifestPath = $themeRoot . '/theme.json';
        if (!is_file($manifestPath) || !is_readable($manifestPath)) {
            return null;
        }
        try {
            $data = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
            $entry = is_array($data) ? ThemeManifest::fromArray($data)->entry : '';
        } catch (\Throwable) {
            return null;
        }

        return $entry !== '' ? $entry : null;
    }

    /** Absolute path of the declared entry; null when it is missing or resolves outside the theme. */
    public static function resolveDeclaredEntryPath(string $themeRoot, string $relative): ?string
    {
        if (!self::isValidEntryPath($relative)) {
            return null;
        }
        $root = realpath($themeRoot);
        $path = self::readableFile($themeRoot, $relative);
        $real = $path !== null ? realpath($path) : false;
        if ($root === false || $real === false || !str_starts_with($real, rtrim($root, '/\\') . DIRECTORY_SEPARATOR)) {
            return null;
        }

        return $real;
    }

    public static function resolveThemeEntryPath(string $themeRoot, string $logicalView): ?string
    {
        // A declared entry is authoritative: a missing file does not fall back to the default lookup.
        $declared = self::declaredEntry($themeRoot);
        if ($declared !== null) {
            return self::resolveDeclaredEntryPath($themeRoot, $declared);
        }

        foreach (self::unifiedPhpEntries() as $relative) {
            $path = self::readableFile($themeRoot, $relative);
            if ($path !== null) {
                return $path;
            }
        }

        foreach (self::legacyPhpTemplateCandidates($logicalView) as $relative) {
            $path = self::readableFile($themeRoot, $relative);
            if ($path !== null) {
                return $path;
            }
        }

        return null;
    }

    /** @deprecated Use {@see resolveThemeEntryPath()} */
    public static function resolvePhpTemplate(string $themeRoot, string $viewName): ?string
    {
        return self::resolveThemeEntryPath($themeRoot, $viewName);
    }

    public static function themeHasPhpRenderEntry(string $themeRoot): bool
    {
        return self::resolveThemeEntryPath($themeRoot, self::VIEW_PAGE) !== null
            || self::resolveThemeEntryPath($themeRoot, self::VIEW_NOT_FOUND) !== null;
    }

    /** @return list<string> Legacy paths when no theme index.php exists; index.php before page.php. */
    public static function legacyPhpTemplateCandidates(string $viewName): array
    {
        $candidates = [];
        foreach (['', 'src/'] as $base) {
            foreach (self::legacyCandidatesForBase($viewName, $base) as $relative) {
                $candidates[] = $relative;
            }
        }

        return array_values(array_unique($candidates));
    }

    /** @return list<string> */
    private static function legacyCandidatesForBase(string $name, string $base): array
    {
        $candidates = [
            "{$base}pages/{$name}/index.php",
            "{$base}pages/{$name}.php",
            "{$base}pages/{$name}/page.php",
        ];
        if ($base === '') {
            $candidates[] = "{$name}.php";
        }
        if ($name === self::VIEW_PAGE) {
            array_splice($candidates, 3, 0, ["{$base}pages/index.php"]);
        } elseif ($name === 'index') {
            array_unshift(
                $candidates,
                "{$base}pages/index/index.php",
                "{$base}pages/index/page.php",
                "{$base}pages/index.php",
            );
        }

        return $candidates;
    }

    private static function readableFile(string $themeRoot, string $relative): ?string
    {
        $path = $themeRoot . '/' . $relative;
        if (is_file($path) && is_readable($path)) {
            return $path;
        }

        return null;
    }
}
