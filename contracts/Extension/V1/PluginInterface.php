<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface PluginInterface
{
    public function install(PluginContext $context): void;

    public function activate(PluginContext $context): void;

    public function deactivate(PluginContext $context): void;
}
