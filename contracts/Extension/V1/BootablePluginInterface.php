<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface BootablePluginInterface
{
    public function boot(PluginContext $context): void;
}
