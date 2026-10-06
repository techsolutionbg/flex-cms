<?php

declare(strict_types=1);

namespace Flex\Http\Controller\Auth;

use Flex\Auth\PasswordRecovery;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Psr\Http\Message\{ResponseInterface, ServerRequestInterface};
use Psr\Log\LoggerInterface;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

final readonly class PasswordRecoveryController
{
    public function __construct(private PasswordRecovery $recovery, private ResponseFactoryInterface $responses, private RequestInput $input, private LoggerInterface $logger) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $input = $this->input->all($request);
        $value = static fn(string $key): string => is_string($input[$key] ?? null) ? $input[$key] : '';
        $ip = $request->getServerParams()['REMOTE_ADDR'] ?? 'unknown';
        $ip = is_string($ip) ? $ip : 'unknown';
        $stage = $arguments['stage'] ?? '';
        try {
            if ($stage === 'request') {
                try {
                    $this->recovery->request($value('email'), $ip);
                } catch (TransportExceptionInterface) {
                    $this->logger->error('Password recovery email delivery failed. Check SMTP configuration.');
                }
                $data = ['message' => 'Ако има подходящ профил с този имейл, ще получите код за възстановяване.', 'resend_after' => 60];
            } elseif ($stage === 'verify') {
                $data = ['reset_token' => $this->recovery->verify($value('email'), $value('code'), $ip)];
            } elseif ($stage === 'reset') {
                $this->recovery->reset($value('email'), $value('reset_token'), $value('password'), $value('password_confirmation'), $ip);
                $data = ['message' => 'Паролата е променена успешно. Влезте с новата парола.'];
            } else {
                return $this->responses->json(['error' => ['message' => 'Невалидна заявка.']], 404);
            }
            return $this->responses->json($data, $stage === 'request' ? 202 : 200, ['Cache-Control' => 'no-store']);
        } catch (\InvalidArgumentException $error) {
            return $this->responses->json(['error' => ['message' => $error->getMessage()]], $error->getCode(), ['Cache-Control' => 'no-store', ...($error instanceof \Flex\Auth\Exception\PasswordRecoveryLimited ? ['Retry-After' => (string) $error->retryAfter] : [])]);
        }
    }
}
