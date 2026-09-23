<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Pages;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Pages\PageService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class UpdatePageSettingsController
{
    public function __construct(private RequestInput $input, private PageService $pages, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $id = filter_var($arguments['id'] ?? null, FILTER_VALIDATE_INT);
        if (!is_int($id) || $id < 1) return $this->responses->json(['error' => 'Page ID is invalid.'], 422);
        return $this->responses->json(['page' => $this->pages->updateSettings($id, $this->input->all($request))->toPublicArray()]);
    }
}
