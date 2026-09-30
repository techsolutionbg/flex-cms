<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Auth;

use Flex\Contracts\Http\ViewRendererInterface;
use Flex\Http\View\ViteAssetManager;

final readonly class EmailVerificationPage
{
    public function __construct(private ViewRendererInterface $views, private ViteAssetManager $assets) {}

    public function render(string $csrfToken, ?string $error = null, bool $success = false): string
    {
        return $this->views->render('auth/verify-email.twig', [
            'csrf_token' => $csrfToken,
            'error' => $error,
            'success' => $success,
            'vite_tags' => $this->assets->tags(),
        ]);
    }
}
