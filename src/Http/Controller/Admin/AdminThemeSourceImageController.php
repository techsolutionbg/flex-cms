<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Auth\AuthenticatedUser;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Themes\ThemeSourceBrowser;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminThemeSourceImageController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private ResponseFactoryInterface $responses,
        private ThemeSourceBrowser $source,
    ) {}

    public function __invoke(ServerRequestInterface $request): ResponseInterface
    {
        $user = $this->authentication->user();
        if (!$user instanceof AuthenticatedUser || !$user->isSuperAdmin()) {
            return $this->responses->text('Достъпът е забранен.', 403);
        }
        $query = $request->getQueryParams();
        $theme = $query['theme'] ?? null;
        $path = $query['path'] ?? null;
        if (!is_string($theme) || !is_string($path)) {
            return $this->responses->text('Невалидна заявка.', 422);
        }
        try {
            $image = $this->source->image($theme, $path);
            return $this->responses->text($image['content'], 200, [
                'Content-Type' => $image['mime'],
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
                'Content-Security-Policy' => "default-src 'none'; sandbox",
                'Content-Disposition' => 'inline',
            ]);
        } catch (\InvalidArgumentException $error) {
            $status = $error->getCode();
            return $this->responses->text($error->getMessage(), $status >= 400 && $status <= 599 ? $status : 422);
        }
    }
}
