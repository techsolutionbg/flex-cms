<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Auth;

use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Session\CsrfTokenManager;
use Flex\Users\Exception\EmailVerificationFailed;
use Flex\Mail\EmailVerificationService;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

final readonly class EmailVerificationController
{
    public function __construct(
        private CsrfTokenManager $csrf,
        private EmailVerificationPage $page,
        private EmailVerificationService $verification,
        private RequestInput $input,
        private ResponseFactoryInterface $responses,
    ) {}

    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $input = $this->input->all($request);
        try {
            $this->verification->verify(
                is_string($input['email'] ?? null) ? $input['email'] : '',
                is_string($input['code'] ?? null) ? $input['code'] : '',
            );
        } catch (EmailVerificationFailed $exception) {
            return $this->responses->html($this->page->render($this->csrf->token(), $exception->getMessage()), 422);
        }

        return $this->responses->html($this->page->render($this->csrf->token(), null, true));
    }
}
