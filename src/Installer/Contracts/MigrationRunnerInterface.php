<?php

declare(strict_types=1);

namespace Flex\Installer\Contracts;

interface MigrationRunnerInterface
{
    public function migrate(): void;
}
