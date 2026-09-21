<?php

declare(strict_types=1);

namespace Flex\Contracts\Http;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

interface KernelInterface extends RequestHandlerInterface
{
    public function handle(ServerRequestInterface $request): ResponseInterface;
}
