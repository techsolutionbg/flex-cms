<?php

declare(strict_types=1);

namespace Flex\Installer\Contracts;

use Flex\Installer\InstallerInput;

interface AdministratorCreatorInterface
{
    public function create(InstallerInput $input): void;
}
