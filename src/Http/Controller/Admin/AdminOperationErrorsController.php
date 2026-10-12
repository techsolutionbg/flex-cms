<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Logging\OperationErrorJournal;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminOperationErrorsController
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
            return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        }
        if (strtoupper($request->getMethod()) === 'DELETE') {
            $this->journal->clear();

            return $this->responses->json(['cleared' => true])->withHeader('Cache-Control', 'no-store');
        }
        $file = $this->journal->fileContents();

        return $this->responses->json([
            ...$file,
            'lines' => $this->journal->count(),
        ])->withHeader('Cache-Control', 'no-store');
    }
}
