<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Session\CsrfTokenManager;
use Flex\Updates\Jobs\UpdateJobStore;
use Flex\Updates\Platform\PlatformHistory;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminUpdatesQueueController
{
    public function __construct(
        private UpdateJobStore $jobs,
        private PlatformHistory $history,
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
            $dryRun = ($input['dry_run'] ?? null) === '1';
            $job = $this->jobs->queuePlatformUpdate($dryRun);

            return $this->responses->html($this->page->render(
                $this->csrf->token(),
                $this->history->all(),
                sprintf('Обновяването е поставено в опашката (%s). Стартирайте updates:process чрез cron.', $job->id),
            ));
        } catch (\Throwable $exception) {
            return $this->responses->html($this->page->render($this->csrf->token(), $this->history->all(), null, $exception->getMessage()), 422);
        }
    }
}
