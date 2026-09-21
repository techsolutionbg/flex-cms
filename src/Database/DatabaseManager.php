<?php

declare(strict_types=1);

namespace Flex\Database;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Database\Exception\DatabaseException;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Connection;
use Illuminate\Database\Schema\Builder as SchemaBuilder;

final class DatabaseManager
{
    private Capsule $capsule;

    private bool $booted = false;

    /** @var list<string> */
    private array $connectionNames = [];

    public function __construct(
        private readonly ConfigRepositoryInterface $configuration,
    ) {}

    public function boot(): void
    {
        if ($this->booted) {
            return;
        }

        $connections = $this->configuration->array('database.connections');
        $default = $this->configuration->string('database.default');

        if (!array_key_exists($default, $connections)) {
            throw new DatabaseException(sprintf('The default database connection "%s" is not configured.', $default));
        }

        $this->capsule = new Capsule();
        foreach ($connections as $name => $connection) {
            if (!is_string($name) || !is_array($connection)) {
                throw new DatabaseException('Every database connection must have a string name and array configuration.');
            }

            /** @var array<string, mixed> $connection */
            $this->capsule->addConnection($connection, $name);
            $this->connectionNames[] = $name;
        }

        $this->capsule->getDatabaseManager()->setDefaultConnection($default);
        $this->capsule->bootEloquent();
        $this->booted = true;
    }

    public function isBooted(): bool
    {
        return $this->booted;
    }

    public function connection(?string $name = null): Connection
    {
        $this->boot();

        return $this->capsule->getConnection($name);
    }

    public function schema(?string $connection = null): SchemaBuilder
    {
        return $this->connection($connection)->getSchemaBuilder();
    }

    /**
     * @template TResult
     * @param callable(Connection): TResult $callback
     * @return TResult
     */
    public function transaction(callable $callback, int $attempts = 1, ?string $connection = null): mixed
    {
        if ($attempts < 1) {
            throw new DatabaseException('Transaction attempts must be at least one.');
        }

        $database = $this->connection($connection);

        return $database->transaction(
            static fn(): mixed => $callback($database),
            $attempts,
        );
    }

    public function status(?string $connection = null): DatabaseStatus
    {
        $connectionName = $connection ?? $this->configuration->string('database.default');
        $databaseName = $this->databaseName($connectionName);
        $startedAt = hrtime(true);

        try {
            $database = $this->connection($connectionName);
            $database->select('SELECT 1');
            $serverVersion = (string) $database->getPdo()->getAttribute(\PDO::ATTR_SERVER_VERSION);

            return new DatabaseStatus(
                true,
                $connectionName,
                $databaseName,
                $serverVersion,
                $this->elapsedMilliseconds($startedAt),
            );
        } catch (\Throwable $exception) {
            return new DatabaseStatus(
                false,
                $connectionName,
                $databaseName,
                null,
                $this->elapsedMilliseconds($startedAt),
                $exception->getMessage(),
            );
        }
    }

    public function disconnect(?string $connection = null): void
    {
        if (!$this->booted) {
            return;
        }

        if ($connection !== null) {
            $this->capsule->getDatabaseManager()->disconnect($connection);

            return;
        }

        foreach ($this->connectionNames as $name) {
            $this->capsule->getDatabaseManager()->disconnect($name);
        }
    }

    public function reconnect(?string $connection = null): Connection
    {
        $this->boot();

        return $this->capsule->getDatabaseManager()->reconnect($connection);
    }

    private function databaseName(string $connection): string
    {
        $configured = $this->configuration->get(sprintf('database.connections.%s.database', $connection), '');

        return is_string($configured) ? $configured : '';
    }

    private function elapsedMilliseconds(int $startedAt): float
    {
        return round((hrtime(true) - $startedAt) / 1_000_000, 2);
    }
}
