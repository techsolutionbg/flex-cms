<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Auth;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Session\CsrfTokenManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class CsrfTokenController
{
    public function __construct(
        private CsrfTokenManager $csrf,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        return $this->responses->json(['csrf_token' => $this->csrf->token()]);
    }
}
