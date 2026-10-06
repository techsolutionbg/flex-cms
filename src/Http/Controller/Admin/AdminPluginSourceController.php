<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Extensions\PluginSourceBrowser;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminPluginSourceController
{
    public function __construct(private AuthenticationInterface $auth, private ResponseFactoryInterface $responses, private PluginSourceBrowser $source) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $user = $this->auth->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        }
        $query = $request->getQueryParams();
        $id = $query['plugin'] ?? null;
        $path = $query['path'] ?? null;
        if (!is_string($id) || ($path !== null && !is_string($path))) {
            return $this->responses->json(['error' => ['message' => 'Невалидна заявка.']], 422);
        }
        try {
            $data = $path === null ? ['files' => $this->source->files($id), 'directories' => $this->source->directories($id)] : ['path' => $path, 'content' => $this->source->read($id, $path)];
            return $this->responses->json($data, 200, ['Cache-Control' => 'no-store']);
        } catch (\InvalidArgumentException $error) {
            return $this->responses->json(['error' => ['message' => $error->getMessage()]], $error->getCode(), ['Cache-Control' => 'no-store']);
        }
    }
}
