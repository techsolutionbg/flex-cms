<?php

declare(strict_types=1);

namespace Flex\Session;

use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Session\SessionInterface;

final readonly class CsrfTokenManager
{
    private const TOKEN_KEY = '_csrf_token';
    private const CREATED_KEY = '_csrf_created_at';

    public function __construct(
        private SessionInterface $session,
        private ConfigRepositoryInterface $configuration,
    ) {}

    public function token(): string
    {
        $token = $this->session->get(self::TOKEN_KEY);
        $createdAt = $this->session->get(self::CREATED_KEY);
        $lifetime = $this->configuration->int('session.csrf_token_lifetime');

        if (!is_string($token) || strlen($token) !== 64 || !is_int($createdAt) || $createdAt + $lifetime < time()) {
            $token = bin2hex(random_bytes(32));
            $this->session->put(self::TOKEN_KEY, $token);
            $this->session->put(self::CREATED_KEY, time());
        }

        return $token;
    }

    public function validate(string $token): bool
    {
        return $token !== '' && hash_equals($this->token(), $token);
    }

    public function rotate(): string
    {
        $this->session->remove(self::TOKEN_KEY);
        $this->session->remove(self::CREATED_KEY);

        return $this->token();
    }
}
