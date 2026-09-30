<?php

declare(strict_types=1);

namespace Flex\Mail;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Users\EmailVerificationToken;
use Flex\Users\Exception\EmailVerificationFailed;
use Flex\Users\User;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

final readonly class EmailVerificationService
{
    private const CODE_LIFETIME_MINUTES = 15;

    public function __construct(
        private MailerInterface $mailer,
        private ConfigRepositoryInterface $configuration,
    ) {}

    public function sendCode(User $user): void
    {
        $code = (string) random_int(100000, 999999);
        $now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $expiresAt = $now->modify('+' . self::CODE_LIFETIME_MINUTES . ' minutes');
        EmailVerificationToken::query()->where('user_id', $user->getAttribute('id'))->delete();
        EmailVerificationToken::query()->create([
            'user_id' => $user->getAttribute('id'),
            'token_hash' => $this->hashCode($code),
            'expires_at' => $expiresAt->format('Y-m-d H:i:s'),
            'created_at' => $now->format('Y-m-d H:i:s'),
        ]);

        $from = new Address(
            $this->configuration->string('mail.from.address', 'noreply@localhost'),
            $this->configuration->string('mail.from.name', 'Flex CMS'),
        );
        $email = (new Email())
            ->from($from)
            ->to((string) $user->getAttribute('email'))
            ->subject('Код за потвърждение на имейла · Flex CMS')
            ->text(sprintf("Здравейте, %s!\n\nВашият код за потвърждение е: %s\n\nКодът е валиден %d минути.", (string) $user->getAttribute('name'), $code, self::CODE_LIFETIME_MINUTES))
            ->html(sprintf('<p>Здравейте, %s!</p><p>Вашият код за потвърждение е:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">%s</p><p>Кодът е валиден %d минути.</p>', htmlspecialchars((string) $user->getAttribute('name'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), $code, self::CODE_LIFETIME_MINUTES));
        $this->mailer->send($email);
    }

    public function verify(string $email, string $code): void
    {
        $email = strtolower(trim($email));
        $code = trim($code);
        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || preg_match('/^\d{6}$/', $code) !== 1) {
            throw new EmailVerificationFailed('Имейлът или кодът за потвърждение е невалиден.');
        }

        $user = User::query()->where('email', $email)->first();
        $token = $user instanceof User ? EmailVerificationToken::query()->where('user_id', $user->getAttribute('id'))->where('token_hash', $this->hashCode($code))->whereNull('used_at')->where('expires_at', '>', gmdate('Y-m-d H:i:s'))->first() : null;
        if (!$user instanceof User || !$token instanceof EmailVerificationToken) {
            throw new EmailVerificationFailed('Кодът е невалиден или е изтекъл.');
        }

        $now = gmdate('Y-m-d H:i:s');
        $token->setAttribute('used_at', $now);
        $token->saveOrFail();
        $user->setAttribute('email_verified_at', $now);
        $user->setAttribute('email_verification_required', false);
        $user->saveOrFail();
    }

    private function hashCode(string $code): string
    {
        return hash_hmac('sha256', $code, $this->configuration->string('app.key'));
    }
}
