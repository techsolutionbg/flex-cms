<?php

declare(strict_types=1);

namespace Flex;

use Flex\Contracts\Http\KernelInterface;
use Flex\Http\ResponseEmitter;
use Flex\Http\SapiRequestFactory;

final class Application
{
    public function __construct(
        private readonly SapiRequestFactory $requests,
        private readonly KernelInterface $kernel,
        private readonly ResponseEmitter $emitter,
    ) {}

    public function run(): never
    {
        $request = $this->requests->fromGlobals();
        $response = $this->kernel->handle($request);
        $this->emitter->emit($response, $request->getMethod() === 'HEAD');

        exit;
    }
}
