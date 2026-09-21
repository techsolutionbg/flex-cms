<?php

declare(strict_types=1);

namespace Flex\Session;

use Flex\Configuration\ProjectPaths;
use Flex\Contracts\Configuration\ConfigRepositoryInterface;
use Flex\Contracts\Session\SessionInterface;

final class NativeSession implements SessionInterface
{
    private bool $started = false;

    public function __construct(
        private readonly ConfigRepositoryInterface $configuration,
        private readonly ProjectPaths $paths,
    ) {}

    public function start(): void
    {
        if ($this->started || session_status() === PHP_SESSION_ACTIVE) {
            $this->started = true;

            return;
        }

        if ($this->configuration->string('session.driver') !== 'file') {
            throw new \RuntimeException('Only the file session driver is currently supported.');
        }

        $savePath = $this->paths->storage('sessions');
        if (!is_dir($savePath) && !mkdir($savePath, 0775, true) && !is_dir($savePath)) {
            throw new \RuntimeException('The session storage directory cannot be created.');
        }

        session_name($this->configuration->string('session.name'));
        session_save_path($savePath);
        $domain = $this->configuration->get('session.domain');
        session_set_cookie_params([
            'lifetime' => $this->configuration->int('session.lifetime') * 60,
            'path' => $this->configuration->string('session.path'),
            'domain' => is_string($domain) ? $domain : null,
            'secure' => $this->configuration->bool('session.secure'),
            'httponly' => $this->configuration->bool('session.http_only'),
            'samesite' => $this->sameSite(),
        ]);
        if (!session_start([
            'use_strict_mode' => 1,
            'use_only_cookies' => 1,
            'cookie_httponly' => 1,
            'cookie_secure' => $this->configuration->bool('session.secure') ? 1 : 0,
            'gc_maxlifetime' => $this->configuration->int('session.lifetime') * 60,
        ])) {
            throw new \RuntimeException('The session could not be started.');
        }

        $this->started = true;
    }

    public function has(string $key): bool
    {
        $this->start();

        return array_key_exists($key, $_SESSION);
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $this->start();

        return $_SESSION[$key] ?? $default;
    }

    public function put(string $key, mixed $value): void
    {
        $this->start();
        $_SESSION[$key] = $value;
    }

    public function remove(string $key): void
    {
        $this->start();
        unset($_SESSION[$key]);
    }

    public function regenerate(): void
    {
        $this->start();
        if (!session_regenerate_id(true)) {
            throw new \RuntimeException('The session ID could not be regenerated.');
        }
    }

    public function invalidate(): void
    {
        $this->start();
        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $parameters = session_get_cookie_params();
            setcookie($this->configuration->string('session.name'), '', [
                'expires' => time() - 42000,
                'path' => $parameters['path'],
                'domain' => $parameters['domain'],
                'secure' => $parameters['secure'],
                'httponly' => $parameters['httponly'],
                'samesite' => $parameters['samesite'],
            ]);
        }

        session_destroy();
        $this->started = false;
    }

    /** @return 'Lax'|'Strict'|'None' */
    private function sameSite(): string
    {
        return match ($this->configuration->string('session.same_site')) {
            'strict' => 'Strict',
            'none' => 'None',
            default => 'Lax',
        };
    }
}
