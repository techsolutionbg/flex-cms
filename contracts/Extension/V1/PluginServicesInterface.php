<?php

declare(strict_types=1);

namespace Flex\Extension\V1;

/** Optional services available since Flex CMS 0.1.64. */
interface PluginServicesInterface
{
    public function storage(): PluginStorageInterface;

    public function csrfToken(): string;

    public function validateCsrf(string $token): bool;

    /** @param list<string> $recipients */
    public function sendMail(array $recipients, string $subject, string $text, ?string $replyTo = null): void;

    /** @return array{id: string, descriptor: array<string, mixed>}|null */
    public function themeExtension(): ?array;

    /** @param array<string, mixed> $data */
    public function renderThemeTemplate(string $relativePath, array $data): string;
}
