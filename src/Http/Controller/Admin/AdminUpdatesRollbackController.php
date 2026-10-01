<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Session\CsrfTokenManager;
use Flex\Updates\Platform\PlatformHistory;
use Flex\Updates\Jobs\UpdateJobStore;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminUpdatesRollbackController
{
    public function __construct(
        private PlatformHistory $history,
        private UpdateJobStore $jobs,
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
            $job = $this->jobs->queuePlatformRollback($id);

            return $this->responses->html($this->page->render(
                $this->csrf->token(),
                $this->history->all(),
                sprintf('Възстановяването е поставено в опашката (%s) и ще бъде обработено от updater процеса.', $job->id),
            ));
        } catch (\Throwable $exception) {
            return $this->responses->html($this->page->render($this->csrf->token(), $this->history->all(), null, $exception->getMessage()), 422);
        }
    }
}
