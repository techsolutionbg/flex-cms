<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Auth;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Session\CsrfTokenManager;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class LoginFormController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private CsrfTokenManager $csrf,
        private LoginPage $page,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        if ($this->authentication->check()) {
            return $this->responses->text('', 302, ['Location' => '/']);
        }

        return $this->responses->html($this->page->render($this->csrf->token()));
    }
}
