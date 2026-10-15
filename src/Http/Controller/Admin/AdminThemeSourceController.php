<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Themes\ThemeSourceBrowser;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminThemeSourceController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ResponseFactoryInterface $responses,
        private RequestInput $input,
        private ThemeSourceBrowser $source,
    ) {}

    public function __invoke(ServerRequestInterface $request): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->json(['error' => ['message' => 'Достъпът е забранен.']], 403);
        }
        $data = strtoupper($request->getMethod()) === 'PUT' ? $this->input->all($request) : $request->getQueryParams();
        $theme = $data['theme'] ?? null;
        $path = $data['path'] ?? null;
        if (!is_string($theme) || ($path !== null && !is_string($path))) {
            return $this->responses->json(['error' => ['message' => 'Невалидна заявка.']], 422);
        }
        try {
            if (strtoupper($request->getMethod()) === 'PUT') {
                $content = $data['content'] ?? null;
                if (!is_string($path) || !is_string($content)) {
                    throw new \InvalidArgumentException('Невалидна заявка.', 422);
                }
                $this->source->write($theme, $path, $content);
                $result = ['saved' => true, 'path' => $path];
            } else {
                $result = $path === null
                    ? ['files' => $this->source->files($theme), 'directories' => $this->source->directories($theme)]
                    : ['path' => $path, 'content' => $this->source->read($theme, $path)];
            }
            return $this->responses->json($result, 200, ['Cache-Control' => 'no-store']);
        } catch (\InvalidArgumentException $error) {
            $status = $error->getCode();
            return $this->responses->json(['error' => ['message' => $error->getMessage()]], $status >= 400 && $status <= 599 ? $status : 422, ['Cache-Control' => 'no-store']);
        }
    }
}
