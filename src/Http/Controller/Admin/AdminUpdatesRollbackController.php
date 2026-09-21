<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Session\CsrfTokenManager;
use Flex\Updates\Platform\PlatformHistory;
use Flex\Updates\Platform\PlatformRollback;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminUpdatesRollbackController
{
    public function __construct(
        private PlatformHistory $history,
        private PlatformRollback $rollback,
        private RequestInput $input,
        private AdminUpdatesPage $page,
        private CsrfTokenManager $csrf,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        try {
            $input = $this->input->all($request);
            if (($input['confirm'] ?? null) !== '1') {
                throw new \InvalidArgumentException('Rollback requires explicit confirmation.');
            }
            $id = $input['id'] ?? null;
            if (!is_string($id) || $id === '') {
                throw new \InvalidArgumentException('A valid update ID is required.');
            }
            $record = $this->rollback->rollback($id);

            return $this->responses->html($this->page->render(
                $this->csrf->token(),
                $this->history->all(),
                sprintf('Rollback от %s към %s завърши успешно.', $record['to'], $record['from']),
            ));
        } catch (\Throwable $exception) {
            return $this->responses->html($this->page->render($this->csrf->token(), $this->history->all(), null, $exception->getMessage()), 422);
        }
    }
}
