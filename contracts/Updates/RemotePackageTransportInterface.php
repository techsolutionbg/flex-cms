<?php

declare(strict_types=1);

namespace Flex\Contracts\Updates;

interface RemotePackageTransportInterface
{
    public function download(string $url, string $destination, int $maximumBytes): int;
}
