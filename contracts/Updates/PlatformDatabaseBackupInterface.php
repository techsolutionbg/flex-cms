<?php

declare(strict_types=1);

namespace Flex\Contracts\Updates;

interface PlatformDatabaseBackupInterface
{
    public function backup(string $path): void;

    public function restore(string $path): void;
}
