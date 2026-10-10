<?php

declare(strict_types=1);

namespace Flex\Tests\Database;

use Flex\Database\LegacyTimestampConverter;
use PHPUnit\Framework\TestCase;

final class LegacyTimestampConverterTest extends TestCase
{
    private \PDO $pdo;

    protected function setUp(): void
    {
        $this->pdo = new \PDO('sqlite::memory:', null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]);
        $this->pdo->exec('CREATE TABLE pages (id INTEGER PRIMARY KEY, published_at TEXT NULL, created_at TEXT NULL, updated_at TEXT NULL, deleted_at TEXT NULL)');
        $this->pdo->exec('CREATE TABLE settings ("key" TEXT PRIMARY KEY, created_at TEXT NULL, updated_at TEXT NULL)');
        $this->pdo->exec("INSERT INTO pages VALUES (1, '2026-07-01 12:00:00', '2026-01-15 12:00:00', '2026-10-25 02:30:00', NULL)");
        $this->pdo->exec("INSERT INTO pages VALUES (2, NULL, NULL, NULL, NULL)");
        $this->pdo->exec("INSERT INTO settings VALUES ('site.name', '2026-03-29 04:30:00', NULL)");
    }

    public function testConvertsSummerAndWinterTimeAndSkipsNullsAndMissingTables(): void
    {
        $updated = (new LegacyTimestampConverter($this->pdo))->convert('Europe/Sofia');

        self::assertSame(2, $updated);
        $page = $this->pdo->query('SELECT * FROM pages WHERE id = 1')->fetch(\PDO::FETCH_ASSOC);
        self::assertSame('2026-07-01 09:00:00', $page['published_at'], 'Summer time is UTC+3.');
        self::assertSame('2026-01-15 10:00:00', $page['created_at'], 'Winter time is UTC+2.');
        self::assertSame('2026-10-24 23:30:00', $page['updated_at'], 'The repeated hour at the end of summer time uses the first occurrence.');
        self::assertNull($page['deleted_at']);
        self::assertSame('2026-03-29 01:30:00', $this->pdo->query("SELECT created_at FROM settings")->fetchColumn());
        self::assertNull($this->pdo->query('SELECT published_at FROM pages WHERE id = 2')->fetchColumn());
    }

    public function testUtcSourceChangesNothing(): void
    {
        self::assertSame(0, (new LegacyTimestampConverter($this->pdo))->convert('UTC'));
        self::assertSame('2026-07-01 12:00:00', $this->pdo->query('SELECT published_at FROM pages WHERE id = 1')->fetchColumn());
    }

    public function testSourceZonePrefersTheExplicitSetting(): void
    {
        $_ENV['FLEX_LEGACY_TIMEZONE'] = 'Europe/London';
        try {
            self::assertSame('Europe/London', LegacyTimestampConverter::sourceZone());
            $_ENV['FLEX_LEGACY_TIMEZONE'] = 'Invalid/Zone';
            self::assertSame('UTC', LegacyTimestampConverter::sourceZone());
        } finally {
            unset($_ENV['FLEX_LEGACY_TIMEZONE']);
        }
    }
}
