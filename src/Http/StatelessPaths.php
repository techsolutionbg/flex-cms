<?php

declare(strict_types=1);

namespace Flex\Http;

/**
 * Requests served without a session or signed-in user: the health check, media files and the public files of
 * themes and plugins. Starting a session there would write a session file and send a cookie for every file,
 * and a response with a cookie is not kept in the browser cache.
 */
final class StatelessPaths
{
    public static function matches(string $path): bool
    {
        return $path === '/health'
            || preg_match('#^/media-files/[0-9]+/(original|thumbnail)$#D', $path) === 1
            || preg_match('#^/extensions/[^?]+/assets/.+$#D', $path) === 1
            || preg_match('#^/themes/[a-z0-9][a-z0-9._-]*/(style\.css|assets/.+)$#D', $path) === 1;
    }
}
