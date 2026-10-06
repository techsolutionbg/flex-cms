<?php

declare(strict_types=1);

namespace Flex\Mail;

use Flex\Settings\SectionSettings;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\{Address, Email, RawMessage};

final readonly class SettingsMailer implements MailerInterface
{
    public function __construct(private MailerInterface $mailer, private SectionSettings $settings) {}

    public function send(RawMessage $message, ?Envelope $envelope = null): void
    {
        if ($message instanceof Email) {
            $message = clone $message;
            $defaults = $this->settings->mailDefaults();
            $message->from(new Address($defaults['from_address'], $defaults['from_name']));
            if ($defaults['reply_to'] !== '') $message->replyTo($defaults['reply_to']);
        }
        $this->mailer->send($message, $envelope);
    }
}
