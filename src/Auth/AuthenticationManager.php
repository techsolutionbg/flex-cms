<?php

declare(strict_types=1);

namespace Flex\Auth;

use Flex\Auth\Exception\TooManyLoginAttempts;
use Flex\Contracts\Auth\AuthenticationInterface;
use Flex\Contracts\Session\SessionInterface;
use Flex\Users\User;
use Flex\Users\UserRepository;

final class AuthenticationManager implements AuthenticationInterface
{
    private const SESSION_KEY = 'auth_user_id';
    private const DUMMY_HASH = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

    private bool $resolved = false;
    private ?AuthenticatedUser $currentUser = null;

    public function __construct(
        private readonly UserRepository $users,
        private readonly PasswordHasher $passwords,
        private readonly SessionInterface $session,
        private readonly LoginThrottle $throttle,
    ) {}

    public function user(): ?AuthenticatedUser
    {
        if ($this->resolved) {
            return $this->currentUser;
        }

        $this->resolved = true;
        $userId = $this->session->get(self::SESSION_KEY);
        if (!is_int($userId) && !(is_string($userId) && ctype_digit($userId))) {
            return null;
        }

        $user = $this->users->find((int) $userId);
        if ($user === null || $user->getAttribute('status') !== 'active') {
            $this->session->remove(self::SESSION_KEY);

            return null;
        }

        return $this->currentUser = $user->identity();
    }

    public function check(): bool
    {
        return $this->user() !== null;
    }

    public function attempt(string $email, string $password, string $ipAddress): bool
    {
        $email = strtolower(trim($email));
        if ($this->throttle->tooManyAttempts($email, $ipAddress)) {
            throw new TooManyLoginAttempts('Too many login attempts. Try again in 15 minutes.');
        }

        $user = $this->users->findByEmail($email);
        $hash = $user instanceof User ? (string) $user->getAttribute('password_hash') : self::DUMMY_HASH;
        $valid = $this->passwords->verify($password, $hash);
        if (!$valid || !$user instanceof User || $user->getAttribute('status') !== 'active') {
            $this->throttle->recordFailure($email, $ipAddress);

            return false;
        }

        if ($this->passwords->needsRehash($hash)) {
            $user->setAttribute('password_hash', $this->passwords->hash($password));
        }
        $user->setAttribute('last_login_at', gmdate('Y-m-d H:i:s'));
        $user->saveOrFail();

        $this->session->regenerate();
        $this->session->put(self::SESSION_KEY, (int) $user->getAttribute('id'));
        $this->throttle->clear($email, $ipAddress);
        $this->resolved = true;
        $this->currentUser = $user->identity();

        return true;
    }

    public function logout(): void
    {
        $this->session->invalidate();
        $this->resolved = true;
        $this->currentUser = null;
    }
}
