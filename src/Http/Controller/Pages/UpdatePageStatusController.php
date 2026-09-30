<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Pages;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Pages\PageService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class UpdatePageStatusController
{
    public function __construct(
        private RequestInput $input,
        private PageService $pages,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $id = filter_var($arguments['id'] ?? null, FILTER_VALIDATE_INT);
        if (!is_int($id) || $id < 1) {
            return $this->responses->json(['error' => 'ID на страницата е невалидно.'], 422);
        }

        $data = $this->input->all($request);
        $status = is_string($data['status'] ?? null) ? $data['status'] : '';

        return $this->responses->json(['page' => $this->pages->setStatus($id, $status)->toPublicArray()]);
    }
}
