<?php

declare(strict_types=1);

namespace Flex\Installer\Contracts;

use Flex\Installer\DatabaseProbeResult;
use Flex\Installer\InstallerInput;

interface DatabaseProbeInterface
{
    public function check(InstallerInput $input): DatabaseProbeResult;

    public function connect(InstallerInput $input): \PDO;
}
