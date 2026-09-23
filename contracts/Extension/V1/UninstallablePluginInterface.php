<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface UninstallablePluginInterface
{
    public function uninstall(PluginContext $context): void;
}
