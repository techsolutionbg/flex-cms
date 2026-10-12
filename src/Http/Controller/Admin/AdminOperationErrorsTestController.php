<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Logging\OperationErrorJournal;
use League\Route\Http\Exception\ForbiddenException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/** Super-admin diagnostic: appends a sample entry to storage/logs/operation-errors.jsonl. */
final readonly class AdminOperationErrorsTestController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private OperationErrorJournal $journal,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        if (!$this->authentication->user()?->isSuperAdmin()) {
            throw new ForbiddenException('Достъпът е забранен.');
        }

        $exception = new \RuntimeException('Тестова операционна грешка (диагностика на дневника).');
        $this->journal->record(
            'platform',
            'core',
            'maintenance.test',
            $exception->getMessage(),
            $exception,
            ['source' => 'admin.operation-errors.test'],
        );

        return $this->responses->json(['recorded' => true])->withHeader('Cache-Control', 'no-store');
    }
}
