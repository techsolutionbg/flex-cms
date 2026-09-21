<?php

declare(strict_types=1);

namespace Flex\Updates\Platform;

use Flex\Contracts\Updates\PlatformDatabaseBackupInterface;
use Flex\Database\DatabaseManager;
use Flex\Updates\Exception\PlatformUpdateException;
use PDO;

final readonly class MySqlPlatformDatabaseBackup implements PlatformDatabaseBackupInterface
{
    public function __construct(private DatabaseManager $database) {}

    public function backup(string $path): void
    {
        $pdo = $this->database->connection()->getPdo();
        $tables = [];
        $statement = $pdo->query('SHOW FULL TABLES');
        if ($statement === false) {
            throw new PlatformUpdateException('Database tables cannot be inspected for backup.');
        }

        foreach ($statement->fetchAll(PDO::FETCH_NUM) as $table) {
            $name = $table[0] ?? null;
            $type = strtoupper((string) ($table[1] ?? 'BASE TABLE'));
            if (!is_string($name) || preg_match('/^[A-Za-z0-9_$-]+$/', $name) !== 1) {
                throw new PlatformUpdateException('The database contains an unsafe table name.');
            }
            $quoted = $this->quoteIdentifier($name);
            $createQuery = $type === 'VIEW' ? 'SHOW CREATE VIEW ' : 'SHOW CREATE TABLE ';
            $createStatement = $pdo->query($createQuery . $quoted);
            if ($createStatement === false) {
                throw new PlatformUpdateException(sprintf('The CREATE statement for "%s" cannot be read.', $name));
            }
            $create = $createStatement->fetch(PDO::FETCH_NUM);
            if (!is_array($create) || !is_string($create[1] ?? null)) {
                throw new PlatformUpdateException(sprintf('The CREATE statement for "%s" cannot be read.', $name));
            }

            $entry = [
                'name' => $name,
                'type' => $type,
                'create' => $create[1],
            ];
            if ($type !== 'VIEW') {
                $columnStatement = $pdo->query('SHOW COLUMNS FROM ' . $quoted);
                if ($columnStatement === false) {
                    throw new PlatformUpdateException(sprintf('The columns for "%s" cannot be read.', $name));
                }
                $columns = $columnStatement->fetchAll(PDO::FETCH_COLUMN);
                $rowStatement = $pdo->query('SELECT * FROM ' . $quoted);
                if ($rowStatement === false) {
                    throw new PlatformUpdateException(sprintf('The rows for "%s" cannot be read.', $name));
                }
                $rows = $rowStatement->fetchAll(PDO::FETCH_NUM);
                $entry['columns'] = array_values(array_map('strval', $columns));
                $entry['rows'] = $rows;
            }
            $tables[] = $entry;
        }

        $payload = json_encode([
            'schema' => 1,
            'driver' => 'mysql',
            'created_at' => gmdate(DATE_ATOM),
            'tables' => $tables,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        $this->write($path, $payload . PHP_EOL);
    }

    public function restore(string $path): void
    {
        $contents = @file_get_contents($path);
        if ($contents === false) {
            throw new PlatformUpdateException('The database backup cannot be read.');
        }
        try {
            $snapshot = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new PlatformUpdateException('The database backup contains invalid JSON.', 0, $exception);
        }
        if (!is_array($snapshot) || ($snapshot['schema'] ?? null) !== 1 || !is_array($snapshot['tables'] ?? null)) {
            throw new PlatformUpdateException('The database backup format is invalid.');
        }

        $pdo = $this->database->connection()->getPdo();
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        try {
            $tables = $snapshot['tables'];
            foreach (array_reverse($tables) as $table) {
                if (is_array($table) && is_string($table['name'] ?? null)) {
                    $drop = ($table['type'] ?? 'BASE TABLE') === 'VIEW' ? 'DROP VIEW IF EXISTS ' : 'DROP TABLE IF EXISTS ';
                    $pdo->exec($drop . $this->quoteIdentifier($table['name']));
                }
            }
            foreach (array_filter($tables, static fn(mixed $table): bool => is_array($table) && ($table['type'] ?? 'BASE TABLE') !== 'VIEW') as $table) {
                if (!is_string($table['name'] ?? null) || !is_string($table['create'] ?? null)) {
                    throw new PlatformUpdateException('The database backup contains an invalid table entry.');
                }
                $pdo->exec($table['create']);
                $columns = $table['columns'] ?? null;
                $rows = $table['rows'] ?? null;
                if (!is_array($columns) || !is_array($rows)) {
                    throw new PlatformUpdateException(sprintf('The database backup data for "%s" is invalid.', $table['name']));
                }
                $quotedColumns = implode(', ', array_map(fn(mixed $column): string => $this->quoteIdentifier((string) $column), $columns));
                $placeholders = implode(', ', array_fill(0, count($columns), '?'));
                $insert = $pdo->prepare(sprintf('INSERT INTO %s (%s) VALUES (%s)', $this->quoteIdentifier($table['name']), $quotedColumns, $placeholders));
                if ($insert === false) {
                    throw new PlatformUpdateException(sprintf('The database backup insert for "%s" cannot be prepared.', $table['name']));
                }
                foreach ($rows as $row) {
                    if (!is_array($row) || count($row) !== count($columns) || !$insert->execute(array_values($row))) {
                        throw new PlatformUpdateException(sprintf('The database backup row for "%s" cannot be restored.', $table['name']));
                    }
                }
            }
            foreach (array_filter($tables, static fn(mixed $table): bool => is_array($table) && ($table['type'] ?? 'BASE TABLE') === 'VIEW') as $table) {
                if (!is_string($table['create'] ?? null)) {
                    throw new PlatformUpdateException('The database backup contains an invalid view entry.');
                }
                $pdo->exec($table['create']);
            }
        } finally {
            $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function quoteIdentifier(string $identifier): string
    {
        if (preg_match('/^[A-Za-z0-9_$-]+$/', $identifier) !== 1) {
            throw new PlatformUpdateException('The database backup contains an unsafe identifier.');
        }

        return '`' . $identifier . '`';
    }

    private function write(string $path, string $contents): void
    {
        $directory = dirname($path);
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            throw new PlatformUpdateException('The database backup directory cannot be created.');
        }
        $temporary = $path . '.tmp-' . bin2hex(random_bytes(6));
        if (file_put_contents($temporary, $contents, LOCK_EX) === false || !rename($temporary, $path)) {
            @unlink($temporary);
            throw new PlatformUpdateException('The database backup cannot be written.');
        }
        @chmod($path, 0600);
    }
}
