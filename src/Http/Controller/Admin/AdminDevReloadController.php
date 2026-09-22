<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminDevReloadController
{
    public function __construct(
        private ResponseFactoryInterface $responses,
        private string $basePath,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $files = array_merge(
            [$this->basePath . '/platform.json'],
            glob($this->basePath . '/src/Http/Controller/Admin/*.php') ?: [],
            glob($this->basePath . '/public/assets/admin*.js') ?: [],
        );
        sort($files);

        $fingerprint = [];
        foreach ($files as $file) {
            $fingerprint[] = $file . ':' . (string) (@filemtime($file) ?: 0);
        }

        return $this->responses->json([
            'token' => hash('sha256', implode('|', $fingerprint)),
        ], 200, ['Cache-Control' => 'no-store, private']);
    }
}
