<?php

declare(strict_types=1);

namespace Flex\Installer;

use Flex\Installer\Contracts\AdministratorCreatorInterface;
use Flex\Installer\Contracts\DatabaseProbeInterface;

final readonly class AdministratorCreator implements AdministratorCreatorInterface
{
    public function __construct(
        private DatabaseProbeInterface $database,
    ) {}

    public function create(InstallerInput $input): void
    {
        $pdo = $this->database->connect($input);
        $statement = $pdo->prepare(
            'INSERT INTO users (name, email, password_hash, role, status, created_at, updated_at) '
            . 'VALUES (:name, :email, :password_hash, :role, :status, UTC_TIMESTAMP(), UTC_TIMESTAMP()) '
            . 'ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = VALUES(role), status = VALUES(status), updated_at = UTC_TIMESTAMP()',
        );
        $statement->execute([
            'name' => $input->adminName,
            'email' => $input->adminEmail,
            'password_hash' => password_hash($input->adminPassword, PASSWORD_DEFAULT),
            'role' => 'super_admin',
            'status' => 'active',
        ]);
    }
}
