<?php

declare(strict_types=1);

namespace Flex\Contracts\Auth;

use Flex\Auth\AuthenticatedUser;

interface AuthenticationInterface
{
    public function user(): ?AuthenticatedUser;

    public function check(): bool;

    public function attempt(string $email, string $password, string $ipAddress): bool;

    public function logout(): void;
}
