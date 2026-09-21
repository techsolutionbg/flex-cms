<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Session\CsrfTokenManager;
use Flex\Updates\Platform\PlatformHistory;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminUpdatesController
{
    public function __construct(
        private PlatformHistory $history,
        private AdminUpdatesPage $page,
        private ResponseFactoryInterface $responses,
        private CsrfTokenManager $csrf,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        return $this->responses->html($this->page->render($this->csrf->token(), $this->history->all()));
    }
}
