<?php

declare(strict_types=1);

namespace Flex\Contracts\Updates;

interface RemoteCatalogTransportInterface
{
    public function get(string $url, array $headers = []): RemoteCatalogTransportResponse;
}
