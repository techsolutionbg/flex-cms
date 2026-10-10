<?php

declare(strict_types=1);

namespace Flex\Tests\Extensions;

use Flex\Extension\V1\Time;
use PHPUnit\Framework\TestCase;

final class TimeTest extends TestCase
{
    private string $zone;

    protected function setUp(): void
    {
        $this->zone = date_default_timezone_get();
        // Database strings must be read as UTC even when the PHP default zone differs.
        date_default_timezone_set('Europe/Sofia');
    }

    protected function tearDown(): void
    {
        date_default_timezone_set($this->zone);
    }

    public function testIsoNormalizesEveryInputToUtc(): void
    {
        self::assertSame('2026-07-01T21:30:00Z', Time::iso('2026-07-01 21:30:00'));
        self::assertSame('2026-07-01T18:30:00Z', Time::iso('2026-07-01T21:30:00+03:00'));
        self::assertSame('2026-07-01T21:30:00Z', Time::iso('2026-07-01T21:30:00Z'));
        self::assertSame('2026-01-01T10:00:00Z', Time::iso(new \DateTimeImmutable('2026-01-01 12:00:00', new \DateTimeZone('Europe/Sofia'))));
        self::assertSame('1970-01-02T10:17:36Z', Time::iso(123456));
        self::assertSame('2026-10-10T12:00:00Z', Time::iso('1791633600'));
        self::assertNull(Time::iso(null));
        self::assertNull(Time::iso(''));
        self::assertNull(Time::iso('not a date'));
        self::assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', Time::now());
    }

    public function testHtmlMarksUpTimeForTheBrowser(): void
    {
        self::assertSame('<time datetime="2026-07-01T21:30:00Z" data-flex-time="datetime">01.07.2026 21:30 UTC</time>', Time::html('2026-07-01 21:30:00'));
        self::assertSame('<time datetime="2026-07-01T21:30:00Z" data-flex-time="date">01.07.2026</time>', Time::html('2026-07-01 21:30:00', 'date'));
        self::assertStringContainsString('data-flex-time="datetime"', Time::html('2026-07-01 21:30:00', '"><script>'));
        self::assertSame('', Time::html(null));
    }
}
