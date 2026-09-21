<?php

declare(strict_types=1);

namespace Flex\Installer;

use Flex\Installer\Contracts\DatabaseProbeInterface;

final class DatabaseProbe implements DatabaseProbeInterface
{
    public function check(InstallerInput $input): DatabaseProbeResult
    {
        try {
            $pdo = $this->connect($input);
            $version = (string) $pdo->getAttribute(\PDO::ATTR_SERVER_VERSION);
            $majorVersion = (int) explode('.', $version)[0];
            if ($majorVersion < 8) {
                return new DatabaseProbeResult(false, $version, 'Flex CMS requires MySQL 8.0 or newer.');
            }

            $pdo->query('SELECT 1');

            return new DatabaseProbeResult(true, $version);
        } catch (\Throwable) {
            return new DatabaseProbeResult(false, null, 'The MySQL connection failed. Check the host, port, database and credentials.');
        }
    }

    public function connect(InstallerInput $input): \PDO
    {
        return new \PDO(
            sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $input->databaseHost,
                $input->databasePort,
                $input->databaseName,
            ),
            $input->databaseUsername,
            $input->databasePassword,
            [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                \PDO::ATTR_EMULATE_PREPARES => false,
                \PDO::ATTR_TIMEOUT => 5,
            ],
        );
    }
}
