<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Pages;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Pages\PageService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class RestorePageController
{
    public function __construct(private PageService $pages, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $id = filter_var($arguments['id'] ?? null, FILTER_VALIDATE_INT);
        if (!is_int($id) || $id < 1) return $this->responses->json(['error' => 'Page ID is invalid.'], 422);
        $this->pages->restore($id);
        return $this->responses->json(['message' => 'Page restored.']);
    }
}
