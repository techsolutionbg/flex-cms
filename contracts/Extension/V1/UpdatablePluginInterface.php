<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

interface UpdatablePluginInterface
{
    public function update(PluginContext $context, string $fromVersion): void;
}
