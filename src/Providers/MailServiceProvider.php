<?php

declare(strict_types=1);

namespace Flex\Providers;

use function DI\factory;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Container\ServiceProviderInterface;
use Flex\Mail\EmailVerificationService;
use Psr\Container\ContainerInterface;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mailer\Transport;

final class MailServiceProvider implements ServiceProviderInterface
{
    public function definitions(): array
    {
        return [
            MailerInterface::class => factory(static function (ConfigRepositoryInterface $configuration, \Flex\Settings\SectionSettings $settings): MailerInterface {
                return new \Flex\Mail\SettingsMailer(new Mailer(Transport::fromDsn($configuration->string('mail.dsn'))), $settings);
            }),
            EmailVerificationService::class => static fn(ContainerInterface $container): EmailVerificationService => new EmailVerificationService(
                $container->get(MailerInterface::class),
                $container->get(ConfigRepositoryInterface::class),
            ),
        ];
    }

    public function boot(ContainerInterface $container): void {}
}
