<?php

declare(strict_types=1);

namespace Flex\Contracts\Updates;

interface PlatformHealthCheckerInterface
{
    public function check(): void;
}
