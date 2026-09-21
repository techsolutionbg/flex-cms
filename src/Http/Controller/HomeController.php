<?php

declare(strict_types=1);

namespace Flex\Http\Controller;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Updates\Platform\PlatformVersionRegistry;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class HomeController
{
    public function __construct(
        private ResponseFactoryInterface $responses,
        private ConfigRepositoryInterface $configuration,
        private PlatformVersionRegistry $versions,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        return $this->responses->json([
            'application' => $this->configuration->string('app.name'),
            'status' => 'application-ready',
            'version' => $this->versions->current()->value,
        ]);
    }
}
