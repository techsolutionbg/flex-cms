<?php

declare(strict_types=1);

namespace Flex\Database;

/**
 * Converts DATETIME values that were written in the server's local time zone to UTC.
 * Before 0.1.59 Eloquent timestamps used the PHP default zone from php.ini.
 */
final readonly class LegacyTimestampConverter
{
    /** Core columns written in local time; columns written with gmdate() are already UTC and are not listed. */
    public const COLUMNS = [
        'pages' => ['key' => 'id', 'columns' => ['published_at', 'created_at', 'updated_at', 'deleted_at']],
        'plugins' => ['key' => 'id', 'columns' => ['installed_at', 'activated_at', 'created_at', 'updated_at']],
        'settings' => ['key' => 'key', 'columns' => ['created_at', 'updated_at']],
        'users' => ['key' => 'id', 'columns' => ['created_at', 'updated_at', 'deleted_at']],
    ];

    public function __construct(private \PDO $pdo) {}

    /** The zone the old values were written in: FLEX_LEGACY_TIMEZONE, then the php.ini setting, then UTC. */
    public static function sourceZone(): string
    {
        $configured = trim((string) ($_ENV['FLEX_LEGACY_TIMEZONE'] ?? getenv('FLEX_LEGACY_TIMEZONE') ?: ''));
        // ini_get() returns the php.ini value; date_default_timezone_set() at runtime does not change it.
        $zone = $configured !== '' ? $configured : trim((string) ini_get('date.timezone'));

        return $zone !== '' && in_array($zone, \DateTimeZone::listIdentifiers(), true) ? $zone : 'UTC';
    }

    /**
     * @param array<string, array{key: string, columns: list<string>}> $tables
     * @return int Number of updated rows.
     */
    public function convert(string $fromZone, array $tables = self::COLUMNS): int
    {
        $source = new \DateTimeZone($fromZone);
        if ($source->getName() === 'UTC') {
            return 0;
        }
        $utc = new \DateTimeZone('UTC');
        $updated = 0;
        $ownTransaction = !$this->pdo->inTransaction();
        if ($ownTransaction) {
            $this->pdo->beginTransaction();
        }
        try {
            foreach ($tables as $table => $definition) {
                $columns = $this->existingColumns($table, $definition['columns']);
                if ($columns === []) {
                    continue;
                }
                $key = $this->quote($definition['key']);
                $select = $this->pdo->query('SELECT ' . $key . ', ' . implode(', ', array_map($this->quote(...), $columns)) . ' FROM ' . $this->quote($table));
                foreach ($select === false ? [] : $select->fetchAll(\PDO::FETCH_ASSOC) as $row) {
                    $changes = [];
                    foreach ($columns as $column) {
                        $value = $row[$column];
                        if (!is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/', $value) !== 1) {
                            continue;
                        }
                        $local = \DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', substr($value, 0, 19), $source);
                        if ($local !== false) {
                            $changes[$column] = $local->setTimezone($utc)->format('Y-m-d H:i:s');
                        }
                    }
                    if ($changes === []) {
                        continue;
                    }
                    $assignments = implode(', ', array_map(fn(string $column): string => $this->quote($column) . ' = ?', array_keys($changes)));
                    $statement = $this->pdo->prepare('UPDATE ' . $this->quote($table) . ' SET ' . $assignments . ' WHERE ' . $key . ' = ?');
                    $statement->execute([...array_values($changes), $row[$definition['key']]]);
                    $updated++;
                }
            }
            if ($ownTransaction) {
                $this->pdo->commit();
            }
        } catch (\Throwable $error) {
            if ($ownTransaction && $this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $error;
        }

        return $updated;
    }

    /** @param list<string> $columns @return list<string> */
    private function existingColumns(string $table, array $columns): array
    {
        $existing = [];
        foreach ($columns as $column) {
            try {
                $this->pdo->query('SELECT ' . $this->quote($column) . ' FROM ' . $this->quote($table) . ' LIMIT 1');
                $existing[] = $column;
            } catch (\PDOException) {
                // Missing tables and columns are skipped.
            }
        }

        return $existing;
    }

    private function quote(string $identifier): string
    {
        $quote = $this->pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql' ? '`' : '"';

        return $quote . str_replace($quote, $quote . $quote, $identifier) . $quote;
    }
}
