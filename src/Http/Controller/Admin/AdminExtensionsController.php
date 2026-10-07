<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extensions\AdminExtensionRegistry;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminExtensionsController
{
    public function __construct(private AdminExtensionRegistry $registry, private ResponseFactoryInterface $responses) {}

    public function __invoke(ServerRequestInterface $request): ResponseInterface
    {
        return $this->responses->json($this->registry->bootstrap(), 200, ['Cache-Control' => 'no-store']);
    }
}
