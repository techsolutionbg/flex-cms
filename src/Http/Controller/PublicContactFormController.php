<?php

declare(strict_types=1);

namespace Flex\Http\Controller;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Http\ResponseFactoryInterface;
use Flex\Http\RequestInput;
use Flex\Pages\Page;
use Flex\Pages\PageRepository;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;

final readonly class PublicContactFormController
{
    public function __construct(
        private PageRepository $pages,
        private RequestInput $input,
        private MailerInterface $mailer,
        private ConfigRepositoryInterface $configuration,
        private ResponseFactoryInterface $responses,
    ) {}

    /** @param array<string, string> $arguments */
    public function __invoke(ServerRequestInterface $request, array $arguments = []): ResponseInterface
    {
        $input = $this->input->all($request);
        $pagePath = is_string($input['_page_path'] ?? null) ? trim($input['_page_path'], '/') : '';
        $page = $pagePath !== '' ? $this->pages->findPublishedByPath($pagePath) : null;
        $returnPath = $page instanceof Page ? '/' . $this->pages->publicPath($page) : '/contacts';

        // Ignore automated submissions caught by the hidden honeypot field.
        if ($this->value($input, 'website') !== '') {
            return $this->redirect($returnPath, 'sent');
        }

        $name = $this->value($input, 'name');
        $email = $this->value($input, 'email');
        $phone = $this->value($input, 'phone');
        $message = $this->value($input, 'message');
        if (!$page instanceof Page || $name === '' || mb_strlen($name) > 120 || preg_match('/[\r\n\x00]/', $name)
            || strlen($email) > 190 || filter_var($email, FILTER_VALIDATE_EMAIL) === false
            || mb_strlen($phone) > 40 || preg_match('/[\r\n\x00]/', $phone)
            || mb_strlen($message) < 10 || mb_strlen($message) > 5000) {
            return $this->redirect($returnPath, 'invalid');
        }

        $settings = $page->getAttribute('settings');
        $recipient = is_array($settings) && is_string($settings['contact_email'] ?? null)
            ? trim($settings['contact_email'])
            : 'office@example.com';
        if ($recipient === '') {
            $recipient = 'office@example.com';
        }
        if ($recipient === '' || strlen($recipient) > 190 || filter_var($recipient, FILTER_VALIDATE_EMAIL) === false) {
            return $this->redirect($returnPath, 'unconfigured');
        }

        if (strtolower((string) parse_url($this->configuration->string('mail.dsn', 'null://null'), PHP_URL_SCHEME)) === 'null') {
            return $this->redirect($returnPath, 'error');
        }

        try {
            $this->mailer->send((new Email())
                ->to($recipient)
                ->replyTo($email)
                ->subject('Ново запитване през сайта — RoofCraft')
                ->text("Име: {$name}\nИмейл: {$email}\nТелефон: " . ($phone !== '' ? $phone : 'Не е посочен') . "\n\nСъобщение:\n{$message}"));
        } catch (\Throwable) {
            return $this->redirect($returnPath, 'error');
        }

        return $this->redirect($returnPath, 'sent');
    }

    private function redirect(string $path, string $status): ResponseInterface
    {
        $path = '/' . ltrim($path, '/');
        return $this->responses->text('', 303, ['Location' => $path . '?contact=' . rawurlencode($status) . '#contact-form']);
    }

    /** @param array<string, mixed> $input */
    private function value(array $input, string $key): string
    {
        return is_string($input[$key] ?? null) ? trim($input[$key]) : '';
    }
}
