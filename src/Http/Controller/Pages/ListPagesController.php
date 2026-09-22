<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Pages;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Pages\PageRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class ListPagesController
{
    public function __construct(private PageRepository $pages, private ResponseFactoryInterface $responses) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        return $this->responses->json([
            'pages' => $this->pages->all()->map(static fn(\Flex\Pages\Page $page): array => $page->toPublicArray())->all(),
        ]);
    }
}
