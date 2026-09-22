<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Auth;

use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;

final readonly class LoginPage
{
    public function __construct(private ViewRendererInterface $views, private ViteAssetManager $assets) {}

    public function render(string $csrfToken, ?string $error = null): string
    {
        return $this->views->render('auth/login.twig', ['csrf_token' => $csrfToken, 'error' => $error, 'vite_tags' => $this->assets->tags()]);
    }
}
