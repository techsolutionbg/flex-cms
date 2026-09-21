<?php

declare(strict_types=1);

namespace Flex\Tests\Database;

use Flex\Configuration\ConfigurationRepository;
use Flex\Database\DatabaseManager;
use Flex\Database\Exception\DatabaseException;
use PHPUnit\Framework\TestCase;

final class DatabaseManagerTest extends TestCase
{
    private DatabaseManager $database;

    protected function setUp(): void
    {
        $this->database = $this->manager([
            'sqlite' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
            ],
        ]);
    }

    protected function tearDown(): void
    {
        $this->database->disconnect();
    }

    public function testItBootsEloquentAndExposesTheConfiguredConnection(): void
    {
        self::assertFalse($this->database->isBooted());

        $firstConnection = $this->database->connection();
        $this->database->boot();

        self::assertTrue($this->database->isBooted());
        self::assertSame('sqlite', $firstConnection->getName());
        self::assertSame($firstConnection, $this->database->connection());
    }

    public function testItProvidesSchemaAndTransactionManagement(): void
    {
        $this->database->schema()->create('records', static function ($table): void {
            $table->increments('id');
            $table->string('name');
        });

        $result = $this->database->transaction(static function ($connection): string {
            $connection->table('records')->insert(['name' => 'Flex CMS']);

            return 'created';
        });

        self::assertSame('created', $result);
        self::assertSame('Flex CMS', $this->database->connection()->table('records')->value('name'));
    }

    public function testItReturnsAHealthyConnectionStatus(): void
    {
        $status = $this->database->status();

        self::assertTrue($status->connected);
        self::assertSame('sqlite', $status->connection);
        self::assertSame(':memory:', $status->database);
        self::assertNotNull($status->serverVersion);
        self::assertNull($status->error);
        self::assertGreaterThanOrEqual(0.0, $status->latencyMilliseconds);
    }

    public function testItReturnsAnUnhealthyStatusWithoutThrowingConnectionErrors(): void
    {
        $database = $this->manager([
            'sqlite' => [
                'driver' => 'sqlite',
                'database' => '/missing-directory/flex-cms.sqlite',
                'prefix' => '',
            ],
        ]);

        $status = $database->status();

        self::assertFalse($status->connected);
        self::assertSame('sqlite', $status->connection);
        self::assertNotNull($status->error);
        self::assertNull($status->serverVersion);
    }

    public function testItRejectsAnUnknownDefaultConnection(): void
    {
        $database = $this->manager([], 'missing');

        $this->expectException(DatabaseException::class);
        $this->expectExceptionMessage('The default database connection "missing" is not configured.');

        $database->boot();
    }

    public function testItRejectsInvalidTransactionAttempts(): void
    {
        $this->expectException(DatabaseException::class);
        $this->expectExceptionMessage('Transaction attempts must be at least one.');

        $this->database->transaction(static fn(): null => null, 0);
    }

    /** @param array<string, array<string, mixed>> $connections */
    private function manager(array $connections, string $default = 'sqlite'): DatabaseManager
    {
        return new DatabaseManager(new ConfigurationRepository([
            'database' => [
                'default' => $default,
                'connections' => $connections,
            ],
        ]));
    }
}
