<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Admin;

use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Settings\AdminTranslationOverrides;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class AdminTranslationsController
{
    public function __construct(
        private AuthenticationInterface $authentication,
        private AdminTranslationOverrides $translations,
        private ResponseFactoryInterface $responses,
        private RequestInput $input,
    ) {}

    public function __invoke(ServerRequestInterface $request): ResponseInterface
    {
        if (!$this->authentication->user()?->isSuperAdmin()) {
            return $this->responses->json(['error' => ['message' => 'Access denied.']], 403);
        }

        try {
            $overrides = strtoupper($request->getMethod()) === 'PUT'
                ? $this->translations->save($this->input->all($request))
                : $this->translations->all();

            return $this->responses->json(['overrides' => $overrides])->withHeader('Cache-Control', 'no-store');
        } catch (\InvalidArgumentException $error) {
            return $this->responses->json(['error' => ['message' => $error->getMessage()]], 422);
        }
    }
}
