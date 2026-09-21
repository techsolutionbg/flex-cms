<?php

declare(strict_types=1);

namespace Flex\Http;

use Nyholm\Psr7Server\ServerRequestCreator;
use Psr\Http\Message\ServerRequestInterface;

final readonly class SapiRequestFactory
{
    public function __construct(
        private ServerRequestCreator $creator,
    ) {}

    public function fromGlobals(): ServerRequestInterface
    {
        return $this->creator->fromGlobals();
    }
}
