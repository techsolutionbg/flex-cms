<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

/**
 * Platform time standard: values are stored and exchanged in UTC and converted to the
 * visitor's local time only in the browser, by /assets/flex-time.js.
 *
 * Database strings without a zone ("Y-m-d H:i:s") are always UTC.
 */
final class Time
{
    public const STYLES = ['datetime', 'date', 'relative'];

    /** Current UTC time in the database format. */
    public static function now(): string
    {
        return gmdate('Y-m-d H:i:s');
    }

    /**
     * Normalizes a stored or transferred time value to ISO 8601 UTC, for example "2026-10-10T12:00:00Z".
     * Accepts DateTimeInterface, Unix seconds, "Y-m-d H:i:s" (UTC) and ISO 8601 strings with a zone.
     */
    public static function iso(mixed $value): ?string
    {
        $date = self::parse($value);

        return $date?->format('Y-m-d\TH:i:s\Z');
    }

    /**
     * A <time> element that /assets/flex-time.js shows in the visitor's local time.
     * The text content is the UTC value, used when JavaScript is not available.
     */
    public static function html(mixed $value, string $style = 'datetime'): string
    {
        $date = self::parse($value);
        if ($date === null) {
            return '';
        }
        $style = in_array($style, self::STYLES, true) ? $style : 'datetime';
        $fallback = $date->format($style === 'date' ? 'd.m.Y' : 'd.m.Y H:i') . ($style === 'date' ? '' : ' UTC');

        return '<time datetime="' . $date->format('Y-m-d\TH:i:s\Z') . '" data-flex-time="' . $style . '">' . $fallback . '</time>';
    }

    public static function parse(mixed $value): ?\DateTimeImmutable
    {
        $utc = new \DateTimeZone('UTC');
        if ($value instanceof \DateTimeInterface) {
            return \DateTimeImmutable::createFromInterface($value)->setTimezone($utc);
        }
        if (is_int($value) || (is_string($value) && preg_match('/^\d{9,11}$/', $value) === 1)) {
            return (new \DateTimeImmutable('@' . $value))->setTimezone($utc);
        }
        if (!is_string($value) || trim($value) === '') {
            return null;
        }
        $value = trim($value);
        try {
            // A string without an explicit zone is interpreted in UTC, never in the PHP default zone.
            $date = new \DateTimeImmutable($value, $utc);
        } catch (\Exception) {
            return null;
        }

        return $date->setTimezone($utc);
    }
}
