<?php

declare(strict_types=1);

namespace Flex\Http;

final class SitePath
{
    public static function prefix(): string
    {
        $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
        $directory = rtrim(dirname($script), '/.');

        return $directory === '' ? '' : $directory;
    }

    public static function requestPath(): string
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $path = is_string($path) && $path !== '' ? $path : '/';
        $prefix = self::prefix();

        if ($prefix !== '' && ($path === $prefix || str_starts_with($path, $prefix . '/'))) {
            $path = substr($path, strlen($prefix)) ?: '/';
        }

        return '/' . ltrim($path, '/');
    }
}
