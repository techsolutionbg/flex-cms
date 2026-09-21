<?php

declare(strict_types=1);

namespace Flex\Contracts\Updates;

interface PlatformMigrationRunnerInterface
{
    public function migrate(): void;
}
