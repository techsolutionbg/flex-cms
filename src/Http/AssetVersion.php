<?php

declare(strict_types=1);

namespace Flex\Http;

/**
 * Versions of public theme and plugin files in their URLs (?v=…). A URL with a file's current version never
 * changes content, so browsers keep it for good instead of asking the server again on every page.
 */
final class AssetVersion
{
    public const IMMUTABLE = 'public, max-age=31536000, immutable';

    /** Relative imports of an ES module: from "./x.js", import("../y.js?v=3"), import "./z.js". */
    public const IMPORTS = '~(\bfrom\s*|\bimport\s*\(?\s*)(["\'])(\.{1,2}/[^"\'?\s]+\.js)(?:\?[^"\'\s]*)?\2~';

    /** One stat instead of reading the file; the version changes whenever the file is written. */
    public static function of(string $path): ?string
    {
        $stat = @stat($path);
        if (!is_array($stat) || ($stat['mode'] & 0170000) !== 0100000) {
            return null;
        }

        return substr(hash('sha256', $stat['mtime'] . ':' . $stat['size']), 0, 12);
    }

    /**
     * The version of an ES module together with the modules it imports, since its served copy names their
     * versions: a cached module must change when any module below it changes.
     */
    public static function ofModule(string $path): ?string
    {
        $memo = [];

        return self::moduleVersion($path, $memo, []);
    }

    /**
     * @param array<string, string|null> $memo Versions already worked out in this call.
     * @param array<string, true> $seen Modules on the current import path, against cycles.
     */
    private static function moduleVersion(string $path, array &$memo, array $seen): ?string
    {
        if (array_key_exists($path, $memo)) {
            return $memo[$path];
        }
        $own = self::of($path);
        if ($own === null || isset($seen[$path]) || count($seen) > 20) {
            return $own;
        }
        $source = @file_get_contents($path);
        $parts = [$own];
        if (is_string($source) && preg_match_all(self::IMPORTS, $source, $matches) > 0) {
            foreach (array_unique($matches[3]) as $import) {
                $parts[] = $import . '=' . (self::moduleVersion(dirname($path) . '/' . $import, $memo, $seen + [$path => true]) ?? '');
            }
        }

        return $memo[$path] = count($parts) === 1 ? $own : substr(hash('sha256', implode('|', $parts)), 0, 12);
    }

    /** The version a URL of this file carries: with its imports for modules. */
    public static function forUrl(string $path): ?string
    {
        return str_ends_with($path, '.js') ? self::ofModule($path) : self::of($path);
    }

    /** Whether the request asks for the file's current version, so the response may be cached for good. */
    public static function matches(string $path, mixed $requested): bool
    {
        $current = self::forUrl($path);

        return is_string($requested) && $current !== null && hash_equals($current, $requested);
    }
}
