<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Session\CsrfTokenManager;
use Flex\Updates\Platform\PlatformHistory;
use Flex\Updates\Remote\RemotePlatformUpdater;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminUpdatesRemoteController
{
    public function __construct(
        private RemotePlatformUpdater $updater,
        private PlatformHistory $history,
        private AdminUpdatesPage $page,
        private CsrfTokenManager $csrf,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        try {
            $result = $this->updater->update();

            return $this->responses->html($this->page->render(
                $this->csrf->token(),
                $this->history->all(),
                sprintf('Обновяването от %s до %s завърши успешно.', $result->installation->from->value, $result->installation->to->value),
            ));
        } catch (\Throwable $exception) {
            return $this->responses->html($this->page->render($this->csrf->token(), $this->history->all(), null, $exception->getMessage()), 422);
        }
    }
}
