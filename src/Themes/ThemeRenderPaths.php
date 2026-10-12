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

    public static function resolveThemeEntryPath(string $themeRoot, string $logicalView): ?string
    {
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
